import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

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
  try {
    const transactions = await db.prepare(`
      SELECT * FROM cash_transactions
      WHERE company_slug = ? AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      ORDER BY created_at ASC
    `).all(req.params.companySlug, from, to);
    res.json(transactions);
  } catch (err) {
    console.error('cash range error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug: return latest 50 rows without date filter
router.get('/debug/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  try {
    const all = await db.prepare('SELECT * FROM cash_transactions WHERE company_slug = ? ORDER BY created_at DESC LIMIT 50').all(req.params.companySlug);
    res.json({ count: all.length, rows: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, amount, description, reference_type, reference_id, category } = req.body;
  if (!type || !amount || amount <= 0) return res.status(400).json({ error: 'Valid type and amount required' });
  const id = 'cash_' + Date.now();
  try {
    await db.prepare(`
      INSERT INTO cash_transactions (id, type, amount, description, reference_type, reference_id, category, created_by, company_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, amount, description || '', reference_type || null, reference_id || null, category || null, req.user.id, req.params.companySlug);
    const tx = await db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
    if (!tx) return res.status(500).json({ error: 'Insert succeeded but row not found' });
    res.json(tx);
  } catch (err) {
    console.error('cash POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, amount, description, reference_type, category } = req.body;
  if (!type || !amount || amount <= 0) return res.status(400).json({ error: 'Valid type and amount required' });
  try {
    await db.prepare(`
      UPDATE cash_transactions SET type = ?, amount = ?, description = ?, reference_type = ?, category = ?
      WHERE id = ? AND company_slug = ?
    `).run(type, amount, description || '', reference_type || null, category || null, req.params.id, req.params.companySlug);
    const tx = await db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(req.params.id);
    res.json(tx);
  } catch (err) {
    console.error('cash PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  try {
    await db.prepare('DELETE FROM cash_transactions WHERE id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
    res.json({ success: true });
  } catch (err) {
    console.error('cash DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
