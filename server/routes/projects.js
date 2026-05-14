import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

const FIRST_STAGES = { printing: 'draft', advertising: 'brief' };

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { status, in_tasks } = req.query;
  let sql = 'SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id';
  const conds = [];
  const params = [];
  if (status) { conds.push('p.status = ?'); params.push(status); }
  if (in_tasks === '0') conds.push('p.stage IS NULL');
  else if (in_tasks === '1') conds.push('p.stage IS NOT NULL');
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY p.created_at DESC';
  const projects = await db.prepare(sql).all(...params);
  res.json(projects);
});

router.post('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { title, description, client_name, order_value, down_payment, request_date, request_type_id, execution_method } = req.body;
  const id = 'proj_' + Date.now();
  await db.prepare('INSERT INTO projects (id, title, description, client_name, order_value, down_payment, request_date, request_type_id, execution_method, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, description, client_name, order_value || 0, down_payment || 0, request_date || null, request_type_id || null, execution_method || 'internal', req.user.id);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ?').get(id);
  res.json(project);
});

router.put('/send-to-tasks/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const company = req.params.companySlug;
  const firstStage = FIRST_STAGES[company] || 'draft';
  await db.prepare('UPDATE projects SET stage = ? WHERE id = ?').run(firstStage, req.params.id);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ?').get(req.params.id);
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
    stage=COALESCE(?,stage) WHERE id=?`)
    .run(title, description, status, client_name, order_value, down_payment, request_date, request_type_id, execution_method, is_archived, archive_reason, stage, req.params.id);
  const project = await db.prepare('SELECT p.*, rt.name as request_type_name FROM projects p LEFT JOIN request_types rt ON p.request_type_id = rt.id WHERE p.id = ?').get(req.params.id);
  res.json(project);
});

router.delete('/:companySlug/:id', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;