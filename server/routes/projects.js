import { Router } from 'express';
import { getCompanyDb, getMasterDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

const FIRST_STAGES = { printing: 'draft', advertising: 'brief' };

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { status, in_tasks } = req.query;
  let sql = 'SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.company_slug = ?';
  const params = [req.params.companySlug];
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (in_tasks === '0') sql += ' AND p.stage IS NULL';
  else if (in_tasks === '1') { sql += ' AND p.stage IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = p.id AND company_slug = ?)'; params.push(req.params.companySlug); }
  sql += ' ORDER BY p.created_at DESC';
  const projects = await db.prepare(sql).all(...params);
  res.json(projects);
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { title, description, client_name, order_value, down_payment, request_date, request_type_id, execution_method } = req.body;
  const id = 'proj_' + Date.now();
  await db.prepare('INSERT INTO projects (id, title, description, client_name, order_value, down_payment, request_date, request_type_id, execution_method, created_by, company_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, description, client_name, order_value || 0, down_payment || 0, request_date || null, request_type_id || null, execution_method || 'internal', req.user.id, req.params.companySlug);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ? AND p.company_slug = ?').get(id, req.params.companySlug);
  res.json(project);
});

router.put('/approve/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const company = req.params.companySlug;
  const firstStage = FIRST_STAGES[company] || 'draft';
  await db.prepare('UPDATE projects SET stage = ?, status = ? WHERE id = ? AND company_slug = ?').run(firstStage, 'active', req.params.id, req.params.companySlug);
  const masterDb = getMasterDb();
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ? AND p.company_slug = ?').get(req.params.id, req.params.companySlug);
  const user = await masterDb.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, company_slug) VALUES (?, ?, ?, ?, ?, ?)')
    .run('notif_' + Date.now(), req.user.id, 'تمت الموافقة على مشروع', `تمت الموافقة على المشروع "${project?.title || 'غير معروف'}" من قبل ${user?.full_name || 'المدير'}`, 'success', req.params.companySlug);
  res.json(project);
});

router.put('/reject/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const masterDb = getMasterDb();
  const user = await masterDb.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id);
  await db.prepare('UPDATE projects SET is_archived = 1, status = ? WHERE id = ? AND company_slug = ?').run('rejected', req.params.id, req.params.companySlug);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ? AND p.company_slug = ?').get(req.params.id, req.params.companySlug);
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, company_slug) VALUES (?, ?, ?, ?, ?, ?)')
    .run('notif_' + Date.now(), req.user.id, 'تم رفض مشروع', `تم رفض المشروع "${project?.title || 'غير معروف'}" من قبل ${user?.full_name || 'المدير'}`, 'error', req.params.companySlug);
  res.json(project);
});

router.put('/send-to-tasks/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const company = req.params.companySlug;
  const firstStage = FIRST_STAGES[company] || 'draft';
  await db.prepare('UPDATE projects SET stage = ? WHERE id = ? AND company_slug = ?').run(firstStage, req.params.id, req.params.companySlug);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ? AND p.company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(project);
});

router.put('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { title, description, status, client_name, order_value, down_payment, request_date, request_type_id, execution_method, is_archived, archive_reason, stage } = req.body;
  await db.prepare(`UPDATE projects SET
    title=COALESCE(?,title), description=COALESCE(?,description),
    status=COALESCE(?,status), client_name=COALESCE(?,client_name),
    order_value=COALESCE(?,order_value), down_payment=COALESCE(?,down_payment),
    request_date=COALESCE(?,request_date), request_type_id=COALESCE(?,request_type_id),
    execution_method=COALESCE(?,execution_method),
    is_archived=COALESCE(?,is_archived), archive_reason=COALESCE(?,archive_reason),
    stage=COALESCE(?,stage) WHERE id=? AND company_slug=?`)
    .run(title, description, status, client_name, order_value, down_payment, request_date, request_type_id, execution_method, is_archived, archive_reason, stage, req.params.id, req.params.companySlug);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ? AND p.company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(project);
});

router.delete('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare('DELETE FROM tasks WHERE project_id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
  await db.prepare('DELETE FROM projects WHERE id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
  res.json({ success: true });
});

export default router;