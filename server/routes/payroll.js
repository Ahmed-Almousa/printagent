import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  let sql = 'SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.company_slug = ?';
  const params = [req.params.companySlug];
  if (req.query.month) { sql += ' AND p.month = ?'; params.push(parseInt(req.query.month)); }
  if (req.query.year) { sql += ' AND p.year = ?'; params.push(parseInt(req.query.year)); }
  if (req.query.user_id) { sql += ' AND p.user_id = ?'; params.push(req.query.user_id); }
  sql += ' ORDER BY p.year DESC, p.month DESC';
  const payrolls = await db.prepare(sql).all(...params);
  res.json(payrolls);
});

router.post('/:companySlug/calculate', authenticate, companyAccess, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const now = new Date();
  const month = req.body.month || (now.getMonth() + 1);
  const year = req.body.year || now.getFullYear();

  const employees = await db.prepare('SELECT * FROM employees WHERE is_active = 1 AND company_slug = ?').all(req.params.companySlug);
  const results = [];

  for (const emp of employees) {
    const existingPayslip = await db.prepare('SELECT id FROM payroll WHERE user_id = ? AND month = ? AND year = ? AND company_slug = ?').get(emp.user_id || emp.id, month, year, req.params.companySlug);
    if (existingPayslip) continue;

    const advancesTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM salary_advances WHERE user_id = ? AND status = 'paid' AND company_slug = ? AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?")
      .get(emp.user_id || emp.id, req.params.companySlug, String(month).padStart(2, '0'), String(year));

    const lateDays = await db.prepare(`
      SELECT COUNT(*) as c FROM attendance WHERE user_id = ? AND company_slug = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ? AND clock_in > '09:15:00'
    `).get(emp.user_id || emp.id, req.params.companySlug, String(month).padStart(2, '0'), String(year));

    const latePenalty = (lateDays ? lateDays.c || 0 : 0) * 10;
    const netSalary = emp.base_salary - (advancesTotal ? advancesTotal.total || 0 : 0) - latePenalty;

    const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await db.prepare('INSERT INTO payroll (id, user_id, month, year, base_salary, advances_deducted, late_penalties, net_salary, company_slug) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, emp.user_id || emp.id, month, year, emp.base_salary, advancesTotal ? advancesTotal.total || 0 : 0, latePenalty, Math.max(0, netSalary), req.params.companySlug);

    results.push(await db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.company_slug = ?').get(id, req.params.companySlug));
  }

  res.json(results);
});

router.put('/:companySlug/:id/pay', authenticate, companyAccess, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare("UPDATE payroll SET status = 'paid', paid_at = NOW() WHERE id = ? AND company_slug = ?").run(req.params.id, req.params.companySlug);
  const payroll = await db.prepare('SELECT p.*, u.full_name as user_name FROM payroll p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(payroll);
});

export default router;
