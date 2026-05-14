import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  let sql = 'SELECT a.*, u.full_name as user_name FROM salary_advances a LEFT JOIN users u ON a.user_id = u.id';
  const conditions = [];
  const params = [];
  if (req.query.status) { conditions.push('a.status = ?'); params.push(req.query.status); }
  if (req.query.user_id) { conditions.push('a.user_id = ?'); params.push(req.query.user_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY a.created_at DESC';
  const advances = await db.prepare(sql).all(...params);
  res.json(advances);
});

router.post('/:companySlug', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { amount, reason, repayment_terms } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason/justification is required' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const id = 'adv_' + Date.now();
  await db.prepare('INSERT INTO salary_advances (id, user_id, amount, reason, repayment_terms) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, amount, reason, repayment_terms || null);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?,?,?,?,?)')
    .run('notif_' + Date.now(), req.user.id, 'طلب سلفة جديد', 'تم تقديم طلب سلفة جديدة', 'advance');
  const adv = await db.prepare('SELECT a.*, u.full_name as user_name FROM salary_advances a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ?').get(id);
  res.json(adv);
});

router.put('/:companySlug/:id/review', authenticate, async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { status } = req.body;
  if (!['approved', 'rejected', 'paid'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await db.prepare("UPDATE salary_advances SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?")
    .run(status, req.user.id, req.params.id);
  const adv = await db.prepare('SELECT a.*, u.full_name as user_name FROM salary_advances a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ?').get(req.params.id);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?,?,?,?,?)')
    .run('notif_' + Date.now(), adv.user_id, status === 'approved' ? 'تمت الموافقة على السلفة' : 'تم رفض السلفة', `طلب السلفة ${status === 'approved' ? 'تمت الموافقة عليه' : 'تم رفضه'}`, 'advance');
  res.json(adv);
});

export default router;
