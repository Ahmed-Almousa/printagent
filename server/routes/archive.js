import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const projects = await db.prepare(`
    SELECT p.*, rt.name as request_type_name
    FROM projects p
    LEFT JOIN request_types rt ON p.request_type_id = rt.id
    WHERE p.company_slug = ? AND (p.stage IN ('delivered','cancelled','archived') OR p.is_archived = 1 OR p.status = 'rejected')
    ORDER BY p.created_at DESC
  `).all(req.params.companySlug);

  const result = [];
  for (const proj of projects) {
    const tasks = await db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? AND t.company_slug = ? ORDER BY t.created_at DESC').all(proj.id, req.params.companySlug);
    const tasksWithDetails = [];
    for (const task of tasks) {
      const comments = await db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.task_id = ? AND c.company_slug = ? ORDER BY c.created_at ASC').all(task.id, req.params.companySlug);
      const attachments = await db.prepare('SELECT * FROM task_attachments WHERE task_id = ? AND company_slug = ?').all(task.id, req.params.companySlug);
      tasksWithDetails.push({ ...task, comments, attachments });
    }
    result.push({ ...proj, tasks: tasksWithDetails });
  }

  res.json(result);
});

export default router;