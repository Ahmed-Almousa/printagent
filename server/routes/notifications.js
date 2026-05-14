import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const notifs = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(notifs);
});

router.put('/:companySlug/:id/read', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.put('/:companySlug/read-all', authenticate, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
  res.json({ success: true });
});

export default router;
