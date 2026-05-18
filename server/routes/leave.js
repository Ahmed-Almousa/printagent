import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { status, user_id } = req.query;
  let sql = 'SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE l.company_slug = ?';
  const params = [req.params.companySlug];
  if (status) { sql += ' AND l.status = ?'; params.push(status); }
  if (user_id) { sql += ' AND l.user_id = ?'; params.push(user_id); }
  sql += ' ORDER BY l.created_at DESC';
  const leaves = await db.prepare(sql).all(...params);
  res.json(leaves);
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { type, start_date, end_date, reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason is required' });
  const id = 'lv_' + Date.now();
  await db.prepare('INSERT INTO leave_requests (id, user_id, type, start_date, end_date, reason, company_slug) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, type, start_date, end_date, reason, req.params.companySlug);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, company_slug) VALUES (?,?,?,?,?,?)')
    .run('notif_' + Date.now(), req.user.id, 'طلب إجازة جديد', 'تم تقديم طلب إجازة جديد', 'leave', req.params.companySlug);
  const leave = await db.prepare('SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ? AND l.company_slug = ?').get(id, req.params.companySlug);
  res.json(leave);
});

router.put('/:companySlug/:id/review', authenticate, companyAccess, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await db.prepare("UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND company_slug = ?")
    .run(status, req.user.id, req.params.id, req.params.companySlug);
  const leave = await db.prepare('SELECT l.*, u.full_name as user_name FROM leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ? AND l.company_slug = ?').get(req.params.id, req.params.companySlug);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, company_slug) VALUES (?,?,?,?,?,?)')
    .run('notif_' + Date.now(), leave.user_id, status === 'approved' ? 'تمت الموافقة على الإجازة' : 'تم رفض الإجازة', `طلب الإجازة ${status === 'approved' ? 'تمت الموافقة عليه' : 'تم رفضه'}`, 'leave', req.params.companySlug);
  res.json(leave);
});

export default router;
