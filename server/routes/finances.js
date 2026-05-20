import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug/summary', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const year = req.query.year || new Date().getFullYear();
  const slug = req.params.companySlug;

  const totalRevenue = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM invoices WHERE type = 'sale' AND company_slug = ? AND strftime('%Y', invoice_date) = ?").get(slug, String(year));
  const totalExpenses = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM invoices WHERE type = 'purchase' AND company_slug = ? AND strftime('%Y', invoice_date) = ?").get(slug, String(year));
  const payrollTotal = await db.prepare("SELECT COALESCE(SUM(net_salary),0) as total FROM payroll WHERE company_slug = ? AND strftime('%Y', created_at) = ? AND status = 'paid'").get(slug, String(year));
  const projectRevenue = await db.prepare("SELECT COALESCE(SUM(order_value),0) as total FROM projects WHERE company_slug = ? AND strftime('%Y', created_at) = ?").get(slug, String(year));
  const cashIn = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_transactions WHERE type='in' AND company_slug = ? AND strftime('%Y', created_at) = ?").get(slug, String(year));
  const cashOut = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_transactions WHERE type='out' AND company_slug = ? AND strftime('%Y', created_at) = ?").get(slug, String(year));

  res.json({
    totalRevenue: totalRevenue ? totalRevenue.total : 0,
    totalExpenses: totalExpenses ? totalExpenses.total : 0,
    payrollTotal: payrollTotal ? payrollTotal.total : 0,
    projectRevenue: projectRevenue ? projectRevenue.total : 0,
    cashIn: cashIn ? cashIn.total : 0,
    cashOut: cashOut ? cashOut.total : 0,
    netBalance: ((cashIn ? cashIn.total : 0) + (totalRevenue ? totalRevenue.total : 0)) - ((cashOut ? cashOut.total : 0) + (totalExpenses ? totalExpenses.total : 0) + (payrollTotal ? payrollTotal.total : 0)),
  });
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const { type, month, year } = req.query;
  let sql = 'SELECT i.* FROM invoices i WHERE i.company_slug = ?';
  const params = [req.params.companySlug];
  if (type) { sql += ' AND i.type = ?'; params.push(type); }
  if (month && year) { sql += " AND strftime('%m', i.invoice_date) = ? AND strftime('%Y', i.invoice_date) = ?"; params.push(String(month).padStart(2, '0'), String(year)); }
  sql += ' ORDER BY i.created_at DESC';
  const invoices = await db.prepare(sql).all(...params);
  res.json(invoices);
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

router.post('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const { type, invoice_number, vendor_client_name, amount, description, invoice_date } = req.body;
  if (!type || !vendor_client_name || amount === undefined) {
    return res.status(400).json({ error: 'type, vendor_client_name, and amount are required' });
  }
  const id = 'inv_' + Date.now();
  await db.prepare('INSERT INTO invoices (id, type, invoice_number, vendor_client_name, amount, description, invoice_date, created_by, company_slug) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, type, invoice_number || null, vendor_client_name, amount, description || null, invoice_date || null, req.user.id, req.params.companySlug);
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ? AND company_slug = ?').get(id, req.params.companySlug);
  res.json(invoice);
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const { type, invoice_number, vendor_client_name, amount, description, invoice_date } = req.body;
  await db.prepare(`UPDATE invoices SET
    type = COALESCE(?,type), invoice_number = COALESCE(?,invoice_number),
    vendor_client_name = COALESCE(?,vendor_client_name), amount = COALESCE(?,amount),
    description = COALESCE(?,description), invoice_date = COALESCE(?,invoice_date)
    WHERE id = ? AND company_slug = ?`)
    .run(type || null, invoice_number || null, vendor_client_name || null, amount != null ? amount : null, description || null, invoice_date || null, req.params.id, req.params.companySlug);
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(invoice);
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare('DELETE FROM invoices WHERE id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
  res.json({ success: true });
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/reports', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const year = req.query.year || new Date().getFullYear();
  const slug = req.params.companySlug;

  const monthlyReports = await db.prepare(`
    SELECT
      CAST(strftime('%m', i.invoice_date) AS INTEGER) as month,
      SUM(CASE WHEN i.type = 'sale' THEN i.amount ELSE 0 END) as income,
      SUM(CASE WHEN i.type = 'purchase' THEN i.amount ELSE 0 END) as expenses
    FROM invoices i
    WHERE i.company_slug = ? AND strftime('%Y', i.invoice_date) = ?
    GROUP BY month ORDER BY month
  `).all(slug, String(year));

  const monthlyCashIn = await db.prepare(`
    SELECT CAST(strftime('%m', created_at) AS INTEGER) as month,
      COALESCE(SUM(amount),0) as cash_in
    FROM cash_transactions
    WHERE type='in' AND company_slug = ? AND strftime('%Y', created_at) = ?
    GROUP BY month ORDER BY month
  `).all(slug, String(year));

  const monthlyCashOut = await db.prepare(`
    SELECT CAST(strftime('%m', created_at) AS INTEGER) as month,
      COALESCE(SUM(amount),0) as cash_out
    FROM cash_transactions
    WHERE type='out' AND company_slug = ? AND strftime('%Y', created_at) = ?
    GROUP BY month ORDER BY month
  `).all(slug, String(year));

  const result = [];
  for (let m = 1; m <= 12; m++) {
    const inv = monthlyReports.find(r => r.month === m) || { income: 0, expenses: 0 };
    const pay = monthlyPayroll.find(r => r.month === m) || { payroll: 0 };
    const cin = monthlyCashIn.find(r => r.month === m) || { cash_in: 0 };
    const cout = monthlyCashOut.find(r => r.month === m) || { cash_out: 0 };
    result.push({
      month: m,
      income: inv.income,
      expenses: inv.expenses,
      payroll: pay.payroll,
      cash_in: cin.cash_in,
      cash_out: cout.cash_out,
      net: inv.income + cin.cash_in - inv.expenses - cout.cash_out - pay.payroll,
    });
  }

  res.json(result);
  } catch (err) { console.error('finances error:', err); res.status(500).json({ error: err.message }); }
});

export default router;