import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'databases');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function getDbPath(name) {
  return path.join(DB_DIR, `${name}.db`);
}

const PERMISSIONS_TREE = [
  { key: 'dashboard', name_ar: 'لوحة التحكم', name_en: 'Dashboard', module: 'dashboard', permissions: ['view'] },
  { key: 'projects', name_ar: 'المشاريع', name_en: 'Projects', module: 'projects', permissions: ['view', 'create', 'edit', 'delete', 'archive'] },
  { key: 'tasks', name_ar: 'المهام', name_en: 'Tasks', module: 'tasks', permissions: ['view', 'create', 'edit', 'delete', 'assign', 'approve', 'outsource'] },
  { key: 'employees', name_ar: 'الموظفون', name_en: 'Employees', module: 'employees', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'attendance', name_ar: 'الحضور', name_en: 'Attendance', module: 'attendance', permissions: ['view', 'clock', 'manage'] },
  { key: 'leave', name_ar: 'الإجازات', name_en: 'Leave', module: 'leave', permissions: ['view_own', 'view_all', 'request', 'approve'] },
  { key: 'advances', name_ar: 'السلف', name_en: 'Advances', module: 'advances', permissions: ['view_own', 'view_all', 'request', 'approve'] },
  { key: 'payroll', name_ar: 'الرواتب', name_en: 'Payroll', module: 'payroll', permissions: ['view_own', 'view_all', 'calculate', 'pay'] },
  { key: 'finances', name_ar: 'المالية', name_en: 'Finances', module: 'finances', permissions: ['payroll_view_own', 'payroll_view_all', 'payroll_manage', 'invoices_view', 'invoices_create', 'invoices_delete', 'reports_view'] },
  { key: 'settings', name_ar: 'الإعدادات', name_en: 'Settings', module: 'settings', permissions: ['view', 'manage'] },
  { key: 'notifications', name_ar: 'الإشعارات', name_en: 'Notifications', module: 'notifications', permissions: ['view'] },
  { key: 'chat', name_ar: 'المحادثة', name_en: 'Chat', module: 'chat', permissions: ['view', 'send'] },
  { key: 'archive', name_ar: 'الأرشيف', name_en: 'Archive', module: 'archive', permissions: ['view'] },
];

function getAllPermissionKeys() {
  const keys = [];
  for (const module of PERMISSIONS_TREE) {
    for (const perm of module.permissions) {
      keys.push(`${module.key}.${perm}`);
    }
  }
  return keys;
}

function initMasterDb() {
  const db = new Database(getDbPath('master'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('printing','advertising')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('super_admin','manager','employee')),
      company_id TEXT,
      assigned_stages TEXT,
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      token_version INTEGER DEFAULT 0,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      perm_key TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      module TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const permCount = db.prepare('SELECT COUNT(*) as c FROM permissions').get();
  if (permCount.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO permissions (id, perm_key, name_ar, name_en, module) VALUES (?,?,?,?,?)');
    let idx = 0;
    for (const module of PERMISSIONS_TREE) {
      for (const perm of module.permissions) {
        const key = `${module.key}.${perm}`;
        insert.run(`perm_${idx++}`, key, `${module.name_ar} - ${perm}`, `${module.name_en} - ${perm}`, module.key);
      }
    }
  }

  const companies = db.prepare('SELECT COUNT(*) as c FROM companies').get();
  if (companies.c === 0) {
    const printingId = 'comp_printing';
    const advertisingId = 'comp_advertising';
    db.prepare('INSERT INTO companies (id, name, slug, type) VALUES (?,?,?,?)').run(printingId, 'المطبعة', 'printing', 'printing');
    db.prepare('INSERT INTO companies (id, name, slug, type) VALUES (?,?,?,?)').run(advertisingId, 'الوكالة الإعلانية', 'advertising', 'advertising');

    const hash = bcrypt.hashSync('admin123', 10);
    const allPerms = getAllPermissionKeys().join(',');
    db.prepare('INSERT INTO users (id, username, password, full_name, email, role, permissions) VALUES (?,?,?,?,?,?,?)').run('u_super', 'admin', hash, 'المشرف الرئيسي', 'admin@printagent.com', 'super_admin', allPerms);
    db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_print_mgr', 'mgr_print', hash, 'مدير المطبعة', 'mgr_print@printagent.com', 'manager', printingId, allPerms);
    db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_adv_mgr', 'mgr_adv', hash, 'مدير الوكالة', 'mgr_adv@printagent.com', 'manager', advertisingId, allPerms);
    db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_emp1', 'emp1', hash, 'موظف 1', 'emp1@printagent.com', 'employee', printingId, 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
    db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_emp2', 'emp2', hash, 'موظف 2', 'emp2@printagent.com', 'employee', advertisingId, 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
  } else {
    try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN permissions TEXT"); } catch (e) {}
  }

  try { db.exec("ALTER TABLE companies ADD COLUMN phone TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN address TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN owner_name TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN currency TEXT DEFAULT 'SAR'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN currency_rate REAL DEFAULT 1.0"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN country TEXT DEFAULT 'SA'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN tax_number TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN logo_url TEXT"); } catch (e) {}

  return db;
}

function initCompanyDb(companyType) {
  const db = new Database(getDbPath(companyType));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      assigned_stages TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      position TEXT,
      base_salary REAL DEFAULT 0,
      hire_date TEXT,
      is_active INTEGER DEFAULT 1,
      assigned_stages TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      client_name TEXT,
      order_value REAL DEFAULT 0,
      down_payment REAL DEFAULT 0,
      request_date TEXT,
      request_type_id TEXT,
      execution_method TEXT DEFAULT 'internal' CHECK(execution_method IN ('internal','external','shared')),
      is_archived INTEGER DEFAULT 0,
      archive_reason TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS request_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      stage TEXT NOT NULL,
      assignee_id TEXT,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      due_date TEXT,
      is_outsourced INTEGER DEFAULT 0,
      outsourced_vendor TEXT,
      outsourced_cost REAL DEFAULT 0,
      outsourced_delivery_status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      completed_at TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(assignee_id) REFERENCES users(id),
      FOREIGN KEY(approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      location_lat REAL,
      location_lng REAL,
      status TEXT DEFAULT 'present',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('annual','sick','personal')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS salary_advances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      repayment_terms TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      base_salary REAL NOT NULL,
      deductions REAL DEFAULT 0,
      advances_deducted REAL DEFAULT 0,
      late_penalties REAL DEFAULT 0,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
      paid_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('sale','purchase')),
      invoice_number TEXT,
      vendor_client_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      invoice_date TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  try { db.exec("ALTER TABLE projects ADD COLUMN is_archived INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE projects ADD COLUMN archive_reason TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE projects ADD COLUMN stage TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE employees ADD COLUMN assigned_stages TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN assigned_stages TEXT"); } catch (e) {}

  const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (usersCount.c === 0) {
    const company = masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(companyType);
    if (company) {
      const companyUsers = masterDb.prepare('SELECT id, username, full_name, email, role, is_active FROM users WHERE company_id = ? OR role = ?').all(company.id, 'super_admin');
      for (const u of companyUsers) {
        db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, is_active) VALUES (?,?,?,?,?,?)').run(u.id, u.username, u.full_name, u.email, u.role, u.is_active);
      }
    }
  }

  const typeCount = db.prepare("SELECT COUNT(*) as c FROM request_types").get();
  if (typeCount.c === 0) {
    const types = [
      'ورقيات', 'فلكس', 'أختام', 'بنرات', 'بروشورات',
      'كتب', 'مجلات', 'ملصقات', 'بطاقات', 'مطويات',
      'لوحات إعلانية', 'تصميم جرافيك', 'تغليف', 'هدايا دعائية', 'أخرى'
    ];
    const insert = db.prepare('INSERT INTO request_types (id, name) VALUES (?,?)');
    types.forEach((name, i) => insert.run('rt_' + i, name));
  }

  return db;
}

const masterDb = initMasterDb();
const companyDbs = {};

function getCompanyDb(slug) {
  if (!companyDbs[slug]) {
    companyDbs[slug] = initCompanyDb(slug);
  }
  return companyDbs[slug];
}

function closeAll() {
  masterDb.close();
  Object.values(companyDbs).forEach(db => db.close());
}

export { masterDb, initCompanyDb, getCompanyDb, getDbPath, closeAll };
