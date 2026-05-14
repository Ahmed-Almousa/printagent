import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const router = Router();

const PRINTING_STAGES = ['draft', 'design_review', 'pending_approval', 'production', 'finishing', 'ready_pickup', 'delivered', 'cancelled', 'archived'];
const ADVERTISING_STAGES = ['brief', 'concept_design', 'client_feedback', 'launch', 'reporting', 'delivered', 'cancelled', 'archived'];
const APPROVAL_GATE_STAGE = 'production';

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { project_id, stage } = req.query;
  let sql = 'SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id';
  const conditions = [];
  const params = [];
  if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
  if (stage) { conditions.push('t.stage = ?'); params.push(stage); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY t.created_at DESC';
  const tasks = await db.prepare(sql).all(...params);
  res.json(tasks);
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { project_id, title, description, stage, assignee_id, priority, due_date } = req.body;
  const id = 'task_' + Date.now();
  await db.prepare('INSERT INTO tasks (id, project_id, title, description, stage, assignee_id, priority, due_date, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, project_id, title, description, stage || 'draft', assignee_id || null, priority || 'medium', due_date || null, req.user.id);
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(task);
});

router.put('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { stage, title, description, assignee_id, priority, due_date, is_outsourced, outsourced_vendor, outsourced_cost, outsourced_delivery_status } = req.body;

  if (stage && stage !== task.stage) {
    const slu = req.params.companySlug;
    const isPrinting = slu === 'printing';
    const stages = isPrinting ? PRINTING_STAGES : ADVERTISING_STAGES;
    const approvalStage = isPrinting ? APPROVAL_GATE_STAGE : null;

    if (req.user.role === 'employee') {
      const userRec = await db.prepare('SELECT assigned_stages FROM users WHERE id = ?').get(req.user.id);
      if (userRec && userRec.assigned_stages) {
        const assigned = userRec.assigned_stages.split(',');
        if (!assigned.includes(task.stage)) {
          return res.status(403).json({ error: 'You are not assigned to this stage' });
        }
        const currentIdx = stages.indexOf(task.stage);
        const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
        if (stage !== nextStage && stage !== 'archived') {
          return res.status(403).json({ error: 'You can only advance to the next stage' });
        }
      }
    }

    if (approvalStage && stage === approvalStage && task.stage !== approvalStage) {
      if (req.user.role !== 'super_admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Only managers can approve tasks for production' });
      }
      await db.prepare("UPDATE tasks SET approved_by = ?, approved_at = NOW() WHERE id = ?").run(req.user.id, req.params.id);
    }

    if ((stage === 'done' || stage === 'completed' || stage === 'reporting' || stage === 'delivered') && task.stage !== stage) {
      await db.prepare("UPDATE tasks SET completed_at = NOW() WHERE id = ?").run(req.params.id);
    }
  }

  await db.prepare(`UPDATE tasks SET
    title=COALESCE(?,title), description=COALESCE(?,description),
    stage=COALESCE(?,stage), assignee_id=COALESCE(?,assignee_id),
    priority=COALESCE(?,priority), due_date=COALESCE(?,due_date),
    is_outsourced=COALESCE(?,is_outsourced), outsourced_vendor=COALESCE(?,outsourced_vendor),
    outsourced_cost=COALESCE(?,outsourced_cost), outsourced_delivery_status=COALESCE(?,outsourced_delivery_status)
    WHERE id=?`)
    .run(title, description, stage, assignee_id, priority, due_date, is_outsourced, outsourced_vendor, outsourced_cost, outsourced_delivery_status, req.params.id);

  const updated = await db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ?').get(req.params.id);
  res.json(updated);
});

router.get('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const task = await db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const comments = await db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at ASC').all(req.params.id);
  const attachments = await db.prepare('SELECT * FROM task_attachments WHERE task_id = ?').all(req.params.id);
  res.json({ ...task, comments, attachments });
});

router.post('/:companySlug/:id/comment', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { message } = req.body;
  const id = 'cmt_' + Date.now();
  await db.prepare('INSERT INTO task_comments (id, task_id, user_id, message) VALUES (?,?,?,?)').run(id, req.params.id, req.user.id, message);
  const comment = await db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(id);
  res.json(comment);
});

router.post('/:companySlug/:id/upload', authenticate, companyAccess, upload.array('files'), async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const attachments = [];
  for (const file of req.files) {
    const id = 'att_' + Date.now() + Math.random().toString(36).slice(2);
    await db.prepare('INSERT INTO task_attachments (id, task_id, file_name, file_path, uploaded_by) VALUES (?,?,?,?,?)')
      .run(id, req.params.id, file.originalname, file.path, req.user.id);
    attachments.push(await db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(id));
  }
  res.json(attachments);
});

export default router;
