import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { date, user_id } = req.query;
  let sql = 'SELECT a.*, u.full_name as user_name FROM attendance a LEFT JOIN users u ON a.user_id = u.id WHERE a.company_slug = ?';
  const params = [req.params.companySlug];
  if (date) { sql += ' AND a.date = ?'; params.push(date); }
  if (user_id) { sql += ' AND a.user_id = ?'; params.push(user_id); }
  sql += ' ORDER BY a.created_at DESC';
  const records = await db.prepare(sql).all(...params);
  res.json(records);
});

router.post('/:companySlug/clock-in', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ? AND company_slug = ?').get(req.user.id, today, req.params.companySlug);
  if (existing) return res.status(400).json({ error: 'Already clocked in today' });
  const { lat, lng } = req.body;
  const id = 'att_' + Date.now();
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO attendance (id, user_id, date, clock_in, location_lat, location_lng, company_slug) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, today, now, lat || null, lng || null, req.params.companySlug);
  const record = await db.prepare('SELECT * FROM attendance WHERE id = ? AND company_slug = ?').get(id, req.params.companySlug);
  res.json(record);
});

router.post('/:companySlug/clock-out', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const record = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ? AND company_slug = ?').get(req.user.id, today, req.params.companySlug);
  if (!record) return res.status(400).json({ error: 'Not clocked in today' });
  if (record.clock_out) return res.status(400).json({ error: 'Already clocked out today' });
  const now = new Date().toISOString();
  await db.prepare('UPDATE attendance SET clock_out = ? WHERE id = ? AND company_slug = ?').run(now, record.id, req.params.companySlug);
  const updated = await db.prepare('SELECT * FROM attendance WHERE id = ? AND company_slug = ?').get(record.id, req.params.companySlug);
  res.json(updated);
});

router.get('/:companySlug/today', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = await db.prepare("SELECT a.*, u.full_name as user_name FROM attendance a LEFT JOIN users u ON a.user_id = u.id WHERE a.date = ? AND a.company_slug = ?").all(today, req.params.companySlug);
  const employees = await db.prepare("SELECT id, full_name FROM employees WHERE is_active = 1 AND company_slug = ?").all(req.params.companySlug);
  res.json({ today: todayAtt, employees });
});

export default router;
