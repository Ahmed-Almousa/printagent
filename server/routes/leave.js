import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { status, user_id } = req.query;
  let sql = 'SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id';
  const conditions = [];
  const params = [];
  if (status) { conditions.push('l.status = ?'); params.push(status); }
  if (user_id) { conditions.push('l.user_id = ?'); params.push(user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY l.created_at DESC';
  const leaves = db.prepare(sql).all(...params);
  res.json(leaves);
});

router.post('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, start_date, end_date, reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason is required' });
  const id = 'lv_' + Date.now();
  db.prepare('INSERT INTO leave_requests (id, user_id, type, start_date, end_date, reason) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, type, start_date, end_date, reason);
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?,?,?,?,?)')
    .run('notif_' + Date.now(), req.user.id, 'طلب إجازة جديد', 'تم تقديم طلب إجازة جديد', 'leave');
  const leave = db.prepare('SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ?').get(id);
  res.json(leave);
});

router.put('/:companySlug/:id/review', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare("UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?")
    .run(status, req.user.id, req.params.id);
  const leave = db.prepare('SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ?').get(req.params.id);
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?,?,?,?,?)')
    .run('notif_' + Date.now(), leave.user_id, status === 'approved' ? 'تمت الموافقة على الإجازة' : 'تم رفض الإجازة', `طلب الإجازة ${status === 'approved' ? 'تمت الموافقة عليه' : 'تم رفضه'}`, 'leave');
  res.json(leave);
});

export default router;
