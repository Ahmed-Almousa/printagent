import { Router } from 'express';
import { masterDb, getCompanyDb } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.get('/:companySlug', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { all } = req.query;
  const employees = all
    ? db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id ORDER BY e.full_name').all()
    : db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.is_active = 1 ORDER BY e.full_name').all();
  res.json(employees);
});

router.post('/:companySlug', authenticate, requirePermission('employees.create'), (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const { full_name, email, phone, position, base_salary, username, password, role, assigned_stages, user_id } = req.body;
  const id = 'emp_' + Date.now();

  if (username && password) {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required to create an account' });
    }
    const existing = masterDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const company = masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const userId = 'u_' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    masterDb.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, hash, full_name, email, role || 'employee', company.id, assigned_stages || null);

    db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, assigned_stages, is_active) VALUES (?,?,?,?,?,?,?)')
      .run(userId, username, full_name, email, role || 'employee', assigned_stages || null, 1);

    db.prepare('INSERT INTO employees (id, user_id, full_name, email, phone, position, base_salary, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, userId, full_name, email, phone, position, base_salary || 0, assigned_stages || null);

    const emp = db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(id);
    return res.json(emp);
  }

  if (user_id) {
    db.prepare('INSERT INTO employees (id, user_id, full_name, email, phone, position, base_salary, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, user_id, full_name, email, phone, position, base_salary || 0, assigned_stages || null);
  } else {
    db.prepare('INSERT INTO employees (id, full_name, email, phone, position, base_salary, assigned_stages) VALUES (?,?,?,?,?,?,?)')
      .run(id, full_name, email, phone, position, base_salary || 0, assigned_stages || null);
  }

  const emp = db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(id);
  res.json(emp);
});

router.put('/:companySlug/:id', authenticate, requirePermission('employees.edit'), (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { full_name, email, phone, position, base_salary, assigned_stages, is_active, username, password } = req.body;

  // Update employee record (always)
  db.prepare(`UPDATE employees SET
    full_name=COALESCE(?,full_name), email=COALESCE(?,email),
    phone=COALESCE(?,phone), position=COALESCE(?,position),
    base_salary=COALESCE(?,base_salary), assigned_stages=COALESCE(?,assigned_stages),
    is_active=COALESCE(?,is_active) WHERE id=?`)
    .run(full_name, email, phone, position, base_salary, assigned_stages, is_active, req.params.id);

  if (!emp.user_id && username && password) {
    // --- Create new user account ---
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required to create an account' });
    }
    const existing = masterDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const company = masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const userId = 'u_' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    masterDb.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, assigned_stages) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, username, hash, full_name || emp.full_name, email, 'employee', company.id, assigned_stages || emp.assigned_stages || null);

    db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, assigned_stages, is_active) VALUES (?,?,?,?,?,?,?)')
      .run(userId, username, full_name || emp.full_name, email, 'employee', assigned_stages || emp.assigned_stages || null, 1);

    db.prepare('UPDATE employees SET user_id = ? WHERE id = ?').run(userId, req.params.id);

  } else if (emp.user_id) {
    // --- Update existing user account ---
    const masterUser = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(emp.user_id);
    if (masterUser) {
      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        masterDb.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, emp.user_id);
      }
      if (email !== undefined && email !== masterUser.email) {
        masterDb.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, emp.user_id);
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, emp.user_id);
      }
      if (full_name !== undefined && full_name !== masterUser.full_name) {
        masterDb.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, emp.user_id);
        db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, emp.user_id);
      }
      if (is_active !== undefined) {
        masterDb.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active, emp.user_id);
        db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active, emp.user_id);
      }
      if (assigned_stages !== undefined) {
        masterDb.prepare('UPDATE users SET assigned_stages = ? WHERE id = ?').run(assigned_stages, emp.user_id);
        db.prepare('UPDATE users SET assigned_stages = ? WHERE id = ?').run(assigned_stages, emp.user_id);
      }
    }
  }

  const updated = db.prepare('SELECT e.*, u.username, u.role, u.is_active as user_active FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:companySlug/:id', authenticate, requirePermission('employees.delete'), (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  if (emp.user_id) {
    masterDb.prepare('DELETE FROM users WHERE id = ?').run(emp.user_id);
    db.prepare('DELETE FROM users WHERE id = ?').run(emp.user_id);
  }
  db.prepare('DELETE FROM attendance WHERE user_id = ?').run(emp.user_id || emp.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:companySlug/performance', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const employees = db.prepare('SELECT id, full_name, position FROM employees WHERE is_active = 1').all();
  const performance = employees.map(emp => {
    const completedTasks = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND stage IN ('delivered','archived')").get(emp.id);
    const avgTime = db.prepare(`
      SELECT AVG(
        (julianday(COALESCE(completed_at, datetime('now'))) - julianday(created_at)) * 24
      ) as avg_hours FROM tasks WHERE assignee_id = ? AND completed_at IS NOT NULL
    `).get(emp.id);
    return {
      ...emp,
      completedTasks: completedTasks.c,
      avgCompletionHours: Math.round(avgTime.avg_hours || 0)
    };
  });
  res.json(performance);
});

export default router;