import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const projects = db.prepare(`
    SELECT p.*, rt.name as request_type_name
    FROM projects p
    LEFT JOIN request_types rt ON p.request_type_id = rt.id
    WHERE p.stage IN ('delivered','cancelled','archived') OR p.is_archived = 1
    ORDER BY p.created_at DESC
  `).all();

  const result = projects.map(proj => {
    const tasks = db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC').all(proj.id);
    const tasksWithDetails = tasks.map(task => {
      const comments = db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at ASC').all(task.id);
      const attachments = db.prepare('SELECT * FROM task_attachments WHERE task_id = ?').all(task.id);
      return { ...task, comments, attachments };
    });
    return { ...proj, tasks: tasksWithDetails };
  });

  res.json(result);
});

export default router;