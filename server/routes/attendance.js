import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { date, user_id } = req.query;
  let sql = 'SELECT a.*, u.full_name as user_name FROM attendance a LEFT JOIN users u ON a.user_id = u.id';
  const conditions = [];
  const params = [];
  if (date) { conditions.push('a.date = ?'); params.push(date); }
  if (user_id) { conditions.push('a.user_id = ?'); params.push(user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY a.created_at DESC';
  const records = db.prepare(sql).all(...params);
  res.json(records);
});

router.post('/:companySlug/clock-in', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today);
  if (existing) return res.status(400).json({ error: 'Already clocked in today' });
  const { lat, lng } = req.body;
  const id = 'att_' + Date.now();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO attendance (id, user_id, date, clock_in, location_lat, location_lng) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, today, now, lat || null, lng || null);
  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
  res.json(record);
});

router.post('/:companySlug/clock-out', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today);
  if (!record) return res.status(400).json({ error: 'Not clocked in today' });
  if (record.clock_out) return res.status(400).json({ error: 'Already clocked out today' });
  const now = new Date().toISOString();
  db.prepare('UPDATE attendance SET clock_out = ? WHERE id = ?').run(now, record.id);
  const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id);
  res.json(updated);
});

router.get('/:companySlug/today', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = db.prepare("SELECT a.*, u.full_name as user_name FROM attendance a LEFT JOIN users u ON a.user_id = u.id WHERE a.date = ?").all(today);
  const employees = db.prepare("SELECT id, full_name FROM employees WHERE is_active = 1").all();
  res.json({ today: todayAtt, employees });
});

export default router;
