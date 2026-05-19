import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const notifs = await db.prepare('SELECT * FROM notifications WHERE user_id = ? AND company_slug = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id, req.params.companySlug);
    res.json(notifs);
  } catch (err) { console.error('notifications.js error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/:id/read', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND company_slug = ?").run(req.params.id, req.user.id, req.params.companySlug);
    res.json({ success: true });
  } catch (err) { console.error('notifications.js error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/read-all', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND company_slug = ?").run(req.user.id, req.params.companySlug);
    res.json({ success: true });
  } catch (err) { console.error('notifications.js error:', err); res.status(500).json({ error: err.message }); }
});

export default router;
