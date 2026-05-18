import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess, requirePermission } from '../middleware/auth.js';
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

const PRINTING_STAGES = ['draft', 'design_review', 'production', 'finishing', 'ready_pickup', 'delivered', 'cancelled', 'archived'];
const ADVERTISING_STAGES = ['brief', 'concept_design', 'client_feedback', 'launch', 'reporting', 'delivered', 'cancelled', 'archived'];
const APPROVAL_GATE_STAGE = 'production';

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { project_id, stage } = req.query;
  let sql = `SELECT t.*, u.full_name as assignee_name,
    p.title as project_title, p.order_value as project_order_value,
    p.down_payment as project_down_payment, p.client_name as project_client_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id WHERE t.company_slug = ?`;
  const params = [req.params.companySlug];
  if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
  if (stage) { sql += ' AND t.stage = ?'; params.push(stage); }
  sql += ' ORDER BY t.created_at DESC';
  const tasks = await db.prepare(sql).all(...params);
  res.json(tasks);
});

router.post('/:companySlug', authenticate, companyAccess, requirePermission('tasks.create'), async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { project_id, title, description, stage, assignee_id, priority, due_date } = req.body;
  const id = 'task_' + Date.now();
  await db.prepare('INSERT INTO tasks (id, project_id, title, description, stage, assignee_id, priority, due_date, created_by, company_slug) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, project_id, title, description, stage || 'draft', assignee_id || null, priority || 'medium', due_date || null, req.user.id, req.params.companySlug);
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND company_slug = ?').get(id, req.params.companySlug);
  res.json(task);
});

router.put('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { stage, title, description, assignee_id, priority, due_date, is_outsourced, outsourced_vendor, outsourced_cost, outsourced_delivery_status } = req.body;

  if (stage && stage !== task.stage) {
    const slu = req.params.companySlug;
    const isPrinting = slu === 'printing';
    const stages = isPrinting ? PRINTING_STAGES : ADVERTISING_STAGES;
    const approvalStage = isPrinting ? APPROVAL_GATE_STAGE : null;

    if (req.user.role === 'employee') {
      const userRec = await db.prepare('SELECT assigned_stages FROM users WHERE id = ? AND company_slug = ?').get(req.user.id, req.params.companySlug);
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
      await db.prepare("UPDATE tasks SET approved_by = ?, approved_at = datetime('now') WHERE id = ? AND company_slug = ?").run(req.user.id, req.params.id, req.params.companySlug);
    }

    if ((stage === 'done' || stage === 'completed' || stage === 'reporting' || stage === 'delivered') && task.stage !== stage) {
      await db.prepare("UPDATE tasks SET completed_at = datetime('now') WHERE id = ? AND company_slug = ?").run(req.params.id, req.params.companySlug);
    }
  }

  await db.prepare(`UPDATE tasks SET
    title=COALESCE(?,title), description=COALESCE(?,description),
    stage=COALESCE(?,stage), assignee_id=COALESCE(?,assignee_id),
    priority=COALESCE(?,priority), due_date=COALESCE(?,due_date),
    is_outsourced=COALESCE(?,is_outsourced), outsourced_vendor=COALESCE(?,outsourced_vendor),
    outsourced_cost=COALESCE(?,outsourced_cost), outsourced_delivery_status=COALESCE(?,outsourced_delivery_status)
    WHERE id=? AND company_slug=?`)
    .run(title, description, stage, assignee_id, priority, due_date, is_outsourced, outsourced_vendor, outsourced_cost, outsourced_delivery_status, req.params.id, req.params.companySlug);

  const updated = await db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ? AND t.company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(updated);
});

router.get('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const task = await db.prepare('SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ? AND t.company_slug = ?').get(req.params.id, req.params.companySlug);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const comments = await db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.task_id = ? AND c.company_slug = ? ORDER BY c.created_at ASC').all(req.params.id, req.params.companySlug);
  const attachments = await db.prepare('SELECT * FROM task_attachments WHERE task_id = ? AND company_slug = ?').all(req.params.id, req.params.companySlug);
  res.json({ ...task, comments, attachments });
});

router.post('/:companySlug/:id/comment', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { message } = req.body;
  const id = 'cmt_' + Date.now();
  await db.prepare('INSERT INTO task_comments (id, task_id, user_id, message, company_slug) VALUES (?,?,?,?,?)').run(id, req.params.id, req.user.id, message, req.params.companySlug);
  const comment = await db.prepare('SELECT c.*, u.full_name as user_name FROM task_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ? AND c.company_slug = ?').get(id, req.params.companySlug);
  res.json(comment);
});

router.post('/:companySlug/:id/upload', authenticate, companyAccess, upload.array('files'), async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const attachments = [];
  for (const file of req.files) {
    const id = 'att_' + Date.now() + Math.random().toString(36).slice(2);
    await db.prepare('INSERT INTO task_attachments (id, task_id, file_name, file_path, uploaded_by, company_slug) VALUES (?,?,?,?,?,?)')
      .run(id, req.params.id, file.originalname, file.path, req.user.id, req.params.companySlug);
    attachments.push(await db.prepare('SELECT * FROM task_attachments WHERE id = ? AND company_slug = ?').get(id, req.params.companySlug));
  }
  res.json(attachments);
});

export default router;
