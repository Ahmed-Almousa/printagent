import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getMasterDb, getCompanyDb } from '../config/database.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const masterDb = getMasterDb();
  const user = await masterDb.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (!user.email) {
    return res.status(403).json({ error: 'No email linked to account. Contact manager.' });
  }

  const newVersion = (user.token_version || 0) + 1;
  await masterDb.prepare('UPDATE users SET token_version = ? WHERE id = ?').run(newVersion, user.id);
  user.token_version = newVersion;

  let companyInfo = null;
  if (user.company_id) {
    companyInfo = await masterDb.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
  }

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  res.json({ token, user: { ...safeUser }, company: companyInfo });
});

router.get('/me', authenticate, async (req, res) => {
  const masterDb = getMasterDb();
  const user = await masterDb.prepare('SELECT id, username, full_name, email, role, company_id, assigned_stages, phone, avatar, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  let companyInfo = null;
  if (user.company_id) {
    companyInfo = await masterDb.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
    if (user.role === 'employee') {
      const companyDb = getCompanyDb(companyInfo.slug);
      const emp = await companyDb.prepare('SELECT assigned_stages FROM employees WHERE user_id = ?').get(user.id);
      if (emp && emp.assigned_stages) {
        user.assigned_stages = emp.assigned_stages;
      }
    }
  }
  res.json({ user, company: companyInfo });
});

router.get('/companies', authenticate, async (req, res) => {
  const masterDb = getMasterDb();
  if (req.user.role !== 'super_admin') {
    const company = await masterDb.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
    return res.json([company]);
  }
  const companies = await masterDb.prepare('SELECT * FROM companies').all();
  res.json(companies);
});

router.get('/companies/:slug/stats', authenticate, async (req, res) => {
  const masterDb = getMasterDb();
  const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.slug);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  if (req.user.role !== 'super_admin' && req.user.company_id !== company.id) {
    return res.status(403).json({ error: 'No access' });
  }
  const db = getCompanyDb(company.slug);

  const activeProjects = await db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'active'").get();
  const totalRevenue = await db.prepare('SELECT COALESCE(SUM(order_value),0) as total FROM projects').get();
  const activeTasks = await db.prepare("SELECT COUNT(*) as c FROM tasks WHERE stage NOT IN ('done','completed','delivered','cancelled','archived')").get();
  const employeesCount = await db.prepare('SELECT COUNT(*) as c FROM employees WHERE is_active = 1').get();
  const todayCheckins = await db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date = CURRENT_DATE").get();
  const pendingLeaves = await db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'pending'").get();
  const pendingAdvances = await db.prepare("SELECT COUNT(*) as c FROM salary_advances WHERE status = 'pending'").get();

  const year = req.query.year || new Date().getFullYear();
  const monthlyTasks = await db.prepare(`
    SELECT CAST(EXTRACT(MONTH FROM created_at) AS INTEGER) as month, COUNT(*) as count
    FROM tasks WHERE EXTRACT(YEAR FROM created_at) = ?
    GROUP BY month ORDER BY month
  `).all(String(year));

  const stageDistribution = await db.prepare(`
    SELECT stage, COUNT(*) as count FROM tasks GROUP BY stage ORDER BY count DESC
  `).all();

  const employees = await db.prepare('SELECT id, user_id, full_name FROM employees WHERE is_active = 1').all();
  const attendanceData = await db.prepare(`
    SELECT e.user_id, e.full_name, a.clock_in, a.clock_out
    FROM employees e
    LEFT JOIN attendance a ON e.user_id = a.user_id AND a.date = CURRENT_DATE
    WHERE e.is_active = 1
    ORDER BY e.full_name
  `).all();

  res.json({
    company: company.name,
    activeProjects: activeProjects.c,
    totalRevenue: totalRevenue.total,
    activeTasks: activeTasks.c,
    employees: employeesCount.c,
    todayAttendance: todayCheckins.c,
    pendingLeaves: pendingLeaves.c,
    pendingAdvances: pendingAdvances.c,
    monthlyTasks,
    stageDistribution,
    attendanceData
  });
});

router.put('/profile', authenticate, async (req, res) => {
  const masterDb = getMasterDb();
  const { full_name, email, phone } = req.body;
  await masterDb.prepare('UPDATE users SET full_name = COALESCE(?,full_name), email = COALESCE(?,email), phone = COALESCE(?,phone) WHERE id = ?')
    .run(full_name, email, phone, req.user.id);
  const company = await masterDb.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (company) {
    const db = getCompanyDb(company.slug);
    await db.prepare('UPDATE users SET full_name = COALESCE(?,full_name), email = COALESCE(?,email) WHERE id = ?')
      .run(full_name, email, req.user.id);
    await db.prepare('UPDATE employees SET full_name = COALESCE(?,full_name), email = COALESCE(?,email), phone = COALESCE(?,phone) WHERE user_id = ?')
      .run(full_name, email, phone, req.user.id);
  }
  const user = await masterDb.prepare('SELECT id, username, full_name, email, role, company_id, assigned_stages, phone, avatar, permissions FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

router.put('/password', authenticate, async (req, res) => {
  const masterDb = getMasterDb();
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const user = await masterDb.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  await masterDb.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

export default router;
