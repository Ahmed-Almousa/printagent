import { Router } from 'express';
import { getMasterDb, getCompanyDb } from '../config/database.js';
import { authenticate, requirePermission, companyAccess } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.get('/:companySlug', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { all } = req.query;
  const employees = all
    ? await db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.company_slug = ? ORDER BY e.full_name').all(req.params.companySlug)
    : await db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.company_slug = ? AND e.is_active = 1 ORDER BY e.full_name').all(req.params.companySlug);
  res.json(employees);
});

router.post('/:companySlug', authenticate, companyAccess, requirePermission('employees.create'), async (req, res) => {
  const masterDb = getMasterDb();
  const db = getCompanyDb(req.params.companySlug);
  const { full_name, email, phone, position, base_salary, username, password, role, assigned_stages, user_id } = req.body;
  const id = 'emp_' + Date.now();

  if (username && password) {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required to create an account' });
    }
    const existing = await masterDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const userId = 'u_' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    await masterDb.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, hash, full_name, email, role || 'employee', company.id, assigned_stages || null);

    await db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, assigned_stages, is_active, company_slug) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, full_name, email, role || 'employee', assigned_stages || null, 1, req.params.companySlug);

    await db.prepare('INSERT INTO employees (id, user_id, full_name, email, phone, position, base_salary, assigned_stages, company_slug) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, userId, full_name, email, phone, position, base_salary || 0, assigned_stages || null, req.params.companySlug);

    const emp = await db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ? AND e.company_slug = ?').get(id, req.params.companySlug);
    return res.json(emp);
  }

  if (user_id) {
    await db.prepare('INSERT INTO employees (id, user_id, full_name, email, phone, position, base_salary, assigned_stages, company_slug) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, user_id, full_name, email, phone, position, base_salary || 0, assigned_stages || null, req.params.companySlug);
  } else {
    await db.prepare('INSERT INTO employees (id, full_name, email, phone, position, base_salary, assigned_stages, company_slug) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, full_name, email, phone, position, base_salary || 0, assigned_stages || null, req.params.companySlug);
  }

  const emp = await db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ? AND e.company_slug = ?').get(id, req.params.companySlug);
  res.json(emp);
});

router.put('/:companySlug/:id', authenticate, companyAccess, requirePermission('employees.edit'), async (req, res) => {
  const masterDb = getMasterDb();
  const db = getCompanyDb(req.params.companySlug);
  const emp = await db.prepare('SELECT * FROM employees WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { full_name, email, phone, position, base_salary, assigned_stages, is_active, username, password } = req.body;

  await db.prepare(`UPDATE employees SET
    full_name=COALESCE(?,full_name), email=COALESCE(?,email),
    phone=COALESCE(?,phone), position=COALESCE(?,position),
    base_salary=COALESCE(?,base_salary), assigned_stages=COALESCE(?,assigned_stages),
    is_active=COALESCE(?,is_active) WHERE id=? AND company_slug=?`)
    .run(full_name, email, phone, position, base_salary, assigned_stages, is_active, req.params.id, req.params.companySlug);

  if (!emp.user_id && username && password) {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required to create an account' });
    }
    const existing = await masterDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const userId = 'u_' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    await masterDb.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, hash, full_name || emp.full_name, email, 'employee', company.id, assigned_stages || emp.assigned_stages || null);

    await db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, assigned_stages, is_active, company_slug) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, full_name || emp.full_name, email, 'employee', assigned_stages || emp.assigned_stages || null, 1, req.params.companySlug);

    await db.prepare('UPDATE employees SET user_id = ? WHERE id = ?').run(userId, req.params.id);

  } else if (emp.user_id) {
    const masterUser = await masterDb.prepare('SELECT * FROM users WHERE id = ?').get(emp.user_id);
    if (masterUser) {
      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        await masterDb.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, emp.user_id);
      }
      if (email !== undefined && email !== masterUser.email) {
        await masterDb.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, emp.user_id);
        await db.prepare('UPDATE users SET email = ? WHERE id = ? AND company_slug = ?').run(email, emp.user_id, req.params.companySlug);
      }
      if (full_name !== undefined && full_name !== masterUser.full_name) {
        await masterDb.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, emp.user_id);
        await db.prepare('UPDATE users SET full_name = ? WHERE id = ? AND company_slug = ?').run(full_name, emp.user_id, req.params.companySlug);
      }
      if (is_active !== undefined) {
        await masterDb.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active, emp.user_id);
        await db.prepare('UPDATE users SET is_active = ? WHERE id = ? AND company_slug = ?').run(is_active, emp.user_id, req.params.companySlug);
      }
      if (assigned_stages !== undefined) {
        await masterDb.prepare('UPDATE users SET assigned_stages = ? WHERE id = ?').run(assigned_stages, emp.user_id);
        await db.prepare('UPDATE users SET assigned_stages = ? WHERE id = ? AND company_slug = ?').run(assigned_stages, emp.user_id, req.params.companySlug);
      }
    }
  }

  const updated = await db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ? AND e.company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(updated);
});

router.delete('/:companySlug/:id', authenticate, companyAccess, requirePermission('employees.delete'), async (req, res) => {
  const masterDb = getMasterDb();
  const db = getCompanyDb(req.params.companySlug);
  const emp = await db.prepare('SELECT * FROM employees WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  if (emp.user_id) {
    await masterDb.prepare('DELETE FROM users WHERE id = ?').run(emp.user_id);
    await db.prepare('DELETE FROM users WHERE id = ? AND company_slug = ?').run(emp.user_id, req.params.companySlug);
  }
  await db.prepare('DELETE FROM attendance WHERE user_id = ? AND company_slug = ?').run(emp.user_id || emp.id, req.params.companySlug);
  await db.prepare('DELETE FROM employees WHERE id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
  res.json({ success: true });
});

router.get('/:companySlug/performance', authenticate, companyAccess, async (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const employees = await db.prepare('SELECT id, full_name, position FROM employees WHERE is_active = 1 AND company_slug = ?').all(req.params.companySlug);
  const performance = [];
  for (const emp of employees) {
    const completedTasks = await db.prepare("SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND stage IN ('delivered','archived') AND company_slug = ?").get(emp.id, req.params.companySlug);
    const avgTime = await db.prepare(`
      SELECT AVG(
        (julianday(COALESCE(completed_at, datetime('now'))) - julianday(created_at)) * 24.0
      ) as avg_hours FROM tasks WHERE assignee_id = ? AND completed_at IS NOT NULL AND company_slug = ?
    `).get(emp.id, req.params.companySlug);
    performance.push({
      ...emp,
      completedTasks: completedTasks.c,
      avgCompletionHours: Math.round(avgTime.avg_hours || 0)
    });
  }
  res.json(performance);
});

export default router;