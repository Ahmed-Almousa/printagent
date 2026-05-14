import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  let sql = 'SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id';
  const conditions = [];
  const params = [];
  if (req.query.month) { conditions.push('p.month = ?'); params.push(parseInt(req.query.month)); }
  if (req.query.year) { conditions.push('p.year = ?'); params.push(parseInt(req.query.year)); }
  if (req.query.user_id) { conditions.push('p.user_id = ?'); params.push(req.query.user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY p.year DESC, p.month DESC';
  const payrolls = await db.prepare(sql).all(...params);
  res.json(payrolls);
});

router.post('/:companySlug/calculate', authenticate, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const now = new Date();
  const month = req.body.month || (now.getMonth() + 1);
  const year = req.body.year || now.getFullYear();

  const employees = await db.prepare('SELECT * FROM employees WHERE is_active = 1').all();
  const results = [];

  for (const emp of employees) {
    const existingPayslip = await db.prepare('SELECT id FROM payroll WHERE user_id = ? AND month = ? AND year = ?').get(emp.user_id || emp.id, month, year);
    if (existingPayslip) continue;

    const advancesTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM salary_advances WHERE user_id = ? AND status = 'paid' AND EXTRACT(MONTH FROM created_at) = ? AND EXTRACT(YEAR FROM created_at) = ?")
      .get(emp.user_id || emp.id, String(month), String(year));

    const lateDays = await db.prepare(`
      SELECT COUNT(*) as c FROM attendance WHERE user_id = ? AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ? AND clock_in > '09:15:00'
    `).get(emp.user_id || emp.id, String(month), String(year));

    const latePenalty = (lateDays ? lateDays.c || 0 : 0) * 10;
    const netSalary = emp.base_salary - (advancesTotal ? advancesTotal.total || 0 : 0) - latePenalty;

    const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await db.prepare('INSERT INTO payroll (id, user_id, month, year, base_salary, advances_deducted, late_penalties, net_salary) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, emp.user_id || emp.id, month, year, emp.base_salary, advancesTotal ? advancesTotal.total || 0 : 0, latePenalty, Math.max(0, netSalary));

    results.push(await db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(id));
  }

  res.json(results);
});

router.put('/:companySlug/:id/pay', authenticate, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare("UPDATE payroll SET status = 'paid', paid_at = NOW() WHERE id = ?").run(req.params.id);
  const payroll = await db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(req.params.id);
  res.json(payroll);
});

export default router;
