import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  let sql = 'SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id';
  const conditions = [];
  const params = [];
  if (req.query.month) { conditions.push('p.month = ?'); params.push(parseInt(req.query.month)); }
  if (req.query.year) { conditions.push('p.year = ?'); params.push(parseInt(req.query.year)); }
  if (req.query.user_id) { conditions.push('p.user_id = ?'); params.push(req.query.user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY p.year DESC, p.month DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/:companySlug/calculate', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const now = new Date();
  const month = req.body.month || (now.getMonth() + 1);
  const year = req.body.year || now.getFullYear();

  const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1').all();
  const results = [];

  for (const emp of employees) {
    const existingPayslip = db.prepare('SELECT id FROM payroll WHERE user_id = ? AND month = ? AND year = ?').get(emp.user_id || emp.id, month, year);
    if (existingPayslip) continue;

    const advancesTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM salary_advances WHERE user_id = ? AND status = 'paid' AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?")
      .get(emp.user_id || emp.id, String(month).padStart(2, '0'), String(year));

    const lateDays = db.prepare(`
      SELECT COUNT(*) as c FROM attendance WHERE user_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ? AND clock_in > '09:15:00'
    `).get(emp.user_id || emp.id, String(month).padStart(2, '0'), String(year));

    const latePenalty = lateDays.c * 10;
    const netSalary = emp.base_salary - (advancesTotal.total || 0) - latePenalty;

    const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO payroll (id, user_id, month, year, base_salary, advances_deducted, late_penalties, net_salary) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, emp.user_id || emp.id, month, year, emp.base_salary, advancesTotal.total || 0, latePenalty, Math.max(0, netSalary));

    results.push(db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(id));
  }

  res.json(results);
});

router.put('/:companySlug/:id/pay', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  db.prepare("UPDATE payroll SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(req.params.id);
  const payroll = db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(req.params.id);
  res.json(payroll);
});

export default router;
