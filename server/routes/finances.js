import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug/summary', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const year = req.query.year || new Date().getFullYear();

  const totalRevenue = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM invoices WHERE type = 'sale' AND EXTRACT(YEAR FROM invoice_date) = ?").get(String(year));
  const totalExpenses = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM invoices WHERE type = 'purchase' AND EXTRACT(YEAR FROM invoice_date) = ?").get(String(year));
  const payrollTotal = await db.prepare("SELECT COALESCE(SUM(net_salary),0) as total FROM payroll WHERE EXTRACT(YEAR FROM created_at) = ? AND status = 'paid'").get(String(year));
  const projectRevenue = await db.prepare("SELECT COALESCE(SUM(order_value),0) as total FROM projects WHERE EXTRACT(YEAR FROM created_at) = ?").get(String(year));

  res.json({
    totalRevenue: totalRevenue ? totalRevenue.total : 0,
    totalExpenses: totalExpenses ? totalExpenses.total : 0,
    payrollTotal: payrollTotal ? payrollTotal.total : 0,
    projectRevenue: projectRevenue ? projectRevenue.total : 0,
    netBalance: (totalRevenue ? totalRevenue.total : 0) - (totalExpenses ? totalExpenses.total : 0) - (payrollTotal ? payrollTotal.total : 0),
  });
});

router.get('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, month, year } = req.query;
  let sql = 'SELECT i.* FROM invoices i';
  const conds = [];
  const params = [];
  if (type) { conds.push('i.type = ?'); params.push(type); }
  if (month && year) { conds.push("EXTRACT(MONTH FROM i.invoice_date) = ? AND EXTRACT(YEAR FROM i.invoice_date) = ?"); params.push(String(month), String(year)); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY i.created_at DESC';
  const invoices = await db.prepare(sql).all(...params);
  res.json(invoices);
});

router.post('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, invoice_number, vendor_client_name, amount, description, invoice_date } = req.body;
  if (!type || !vendor_client_name || amount === undefined) {
    return res.status(400).json({ error: 'type, vendor_client_name, and amount are required' });
  }
  const id = 'inv_' + Date.now();
  await db.prepare('INSERT INTO invoices (id, type, invoice_number, vendor_client_name, amount, description, invoice_date, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, type, invoice_number || null, vendor_client_name, amount, description || null, invoice_date || null, req.user.id);
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json(invoice);
});

router.delete('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:companySlug/reports', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const year = req.query.year || new Date().getFullYear();

  const monthlyReports = await db.prepare(`
    SELECT
      CAST(EXTRACT(MONTH FROM i.invoice_date) AS INTEGER) as month,
      SUM(CASE WHEN i.type = 'sale' THEN i.amount ELSE 0 END) as income,
      SUM(CASE WHEN i.type = 'purchase' THEN i.amount ELSE 0 END) as expenses
    FROM invoices i
    WHERE EXTRACT(YEAR FROM i.invoice_date) = ?
    GROUP BY month ORDER BY month
  `).all(String(year));

  const monthlyPayroll = await db.prepare(`
    SELECT CAST(EXTRACT(MONTH FROM created_at) AS INTEGER) as month,
      COALESCE(SUM(net_salary),0) as payroll
    FROM payroll
    WHERE EXTRACT(YEAR FROM created_at) = ? AND status = 'paid'
    GROUP BY month ORDER BY month
  `).all(String(year));

  const result = [];
  for (let m = 1; m <= 12; m++) {
    const inv = monthlyReports.find(r => r.month === m) || { income: 0, expenses: 0 };
    const pay = monthlyPayroll.find(r => r.month === m) || { payroll: 0 };
    result.push({
      month: m,
      income: inv.income,
      expenses: inv.expenses,
      payroll: pay.payroll,
      net: inv.income - inv.expenses - pay.payroll,
    });
  }

  res.json(result);
});

export default router;