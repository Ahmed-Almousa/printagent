import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/today/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const todayStart = new Date().toISOString().slice(0, 10);
  const transactions = await db.prepare(`
    SELECT * FROM cash_transactions
    WHERE company_slug = ? AND created_at >= ? AND created_at < ?
    ORDER BY created_at ASC
  `).all(req.params.companySlug, `${todayStart}T00:00:00`, `${todayStart}T23:59:59`);
  res.json(transactions);
});

router.get('/balance/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const todayStart = new Date().toISOString().slice(0, 10);
  const allIn = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions
    WHERE company_slug = ? AND type = 'in' AND created_at >= ? AND created_at < ?
  `).get(req.params.companySlug, `${todayStart}T00:00:00`, `${todayStart}T23:59:59`);
  const allOut = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions
    WHERE company_slug = ? AND type = 'out' AND created_at >= ? AND created_at < ?
  `).get(req.params.companySlug, `${todayStart}T00:00:00`, `${todayStart}T23:59:59`);
  res.json({ in: allIn.total, out: allOut.total, balance: allIn.total - allOut.total });
});

router.get('/range/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const transactions = await db.prepare(`
    SELECT * FROM cash_transactions
    WHERE company_slug = ? AND created_at >= ? AND created_at < ?
    ORDER BY created_at ASC
  `).all(req.params.companySlug, `${from}T00:00:00`, `${to}T23:59:59`);
  res.json(transactions);
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, amount, description, reference_type, reference_id, category } = req.body;
  if (!type || !amount || amount <= 0) return res.status(400).json({ error: 'Valid type and amount required' });
  const id = uuidv4();
  await db.prepare(`
    INSERT INTO cash_transactions (id, type, amount, description, reference_type, reference_id, category, created_by, company_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, amount, description || '', reference_type || null, reference_id || null, category || null, req.user.id, req.params.companySlug);
  const tx = await db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
  res.json(tx);
});

export default router;
