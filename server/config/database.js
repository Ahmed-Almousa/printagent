import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'databases');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function getDbPath(name) { return path.join(DB_DIR, `${name}.db`); }

let _pgPool = null;

async function getPgPool() {
  if (!_pgPool) {
    const { default: pg } = await import('pg');
    _pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pgPool;
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
  for (const module of PERMISSIONS_TREE)
    for (const perm of module.permissions)
      keys.push(`${module.key}.${perm}`);
  return keys;
}

// ─── SQL TRANSFORMER: SQLite → PostgreSQL ─────────────────────────────────

function transformSQL(sql) {
  let s = sql;
  // julianday → EXTRACT(EPOCH FROM ...)/86400 with proper paren nesting
  s = s.replace(/julianday\(/g, '\x00JD\x00');
  s = s.replace(/\x00JD\x00/g, 'EXTRACT(EPOCH FROM ');
  // Now the EXTRACT clause is missing its closing paren: julianday(X) → EXTRACT(EPOCH FROM X)
  // We need to add )/86400 where the original ) was. The julianday matched up to its own ).
  // Since EXTRACT(EPOCH FROM X needs one more ) than julianday(X, we add )/86400.0
  s = s.replace(/EXTRACT\(EPOCH FROM /g, (m, offset) => {
    let depth = 1;
    let pos = offset + m.length;
    while (depth > 0 && pos < s.length) {
      if (s[pos] === '(') depth++;
      else if (s[pos] === ')') depth--;
      pos++;
    }
    const before = s.slice(0, pos - 1);
    const after = s.slice(pos - 1);
    s = before + ')/86400.0' + after;
    return m;
  });

  // strftime → EXTRACT
  s = s.replace(/strftime\('%m',\s*([^)]+)\s*\)/gi, (match, col) => `EXTRACT(MONTH FROM ${col.trim()})`);
  s = s.replace(/strftime\('%Y',\s*([^)]+)\s*\)/gi, (match, col) => `EXTRACT(YEAR FROM ${col.trim()})`);
  s = s.replace(/\bdatetime\('now'\)/gi, 'NOW()');
  s = s.replace(/\bdate\('now'\)/gi, 'CURRENT_DATE');
  let isInsertOrIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(s);
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\b/gi, 'INSERT');
  // Replace ? with $1, $2, ... (skip ? inside single-quote strings)
  let idx = 0;
  const parts = [];
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1);
      if (end === -1) continue;
      parts.push(s.slice(last, i));
      parts.push(s.slice(i, end + 1));
      i = end;
      last = end + 1;
    } else if (s[i] === '?') {
      parts.push(s.slice(last, i));
      parts.push(`$${++idx}`);
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  s = parts.join('');
  if (isInsertOrIgnore) {
    s = s + ' ON CONFLICT DO NOTHING';
  }
  return s;
}

function isDDL(sql) {
  const t = sql.trimStart();
  return /^CREATE\s/i.test(t) || /^ALTER\s/i.test(t);
}

// ─── POSTGRESQL ADAPTER ────────────────────────────────────────────────────

class PgStatement {
  constructor(pool, sql, isDDLFlag) {
    this.pool = pool;
    this.originalSql = sql;
    this.transformedSql = isDDLFlag ? sql : transformSQL(sql);
  }

  async all(...params) {
    const r = await this.pool.query(this.transformedSql, params);
    return r.rows;
  }

  async get(...params) {
    const r = await this.pool.query(this.transformedSql, params);
    return r.rows[0] || null;
  }

  async run(...params) {
    const r = await this.pool.query(this.transformedSql, params);
    return { changes: r.rowCount, lastInsertRowid: null };
  }
}

class PgDatabase {
  constructor(pool) {
    this.pool = pool;
    this._isPg = true;
  }

  prepare(sql) { return new PgStatement(this.pool, sql, isDDL(sql)); }

  async exec(sql) {
    if (isDDL(sql)) {
      sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMP WITH TIME ZONE');
      sql = sql.replace(/\bREAL\b/gi, 'DOUBLE PRECISION');
    }
    await this.pool.query(sql);
  }

  async close() { await this.pool.end(); }

  pragma() {}
}

// ─── SQLITE ADAPTER (wraps better-sqlite3 in Promise) ────────────────────

class SqliteStatement {
  constructor(stmt) { this._stmt = stmt; }

  all(...p) {
    try { return this._stmt.all(...p); }
    catch (e) { throw e; }
  }
  get(...p) {
    try { return this._stmt.get(...p); }
    catch (e) { throw e; }
  }
  run(...p) {
    try { return this._stmt.run(...p); }
    catch (e) { throw e; }
  }
}

class SqliteDatabase {
  constructor(db) { this._db = db; this._isPg = false; }
  prepare(sql) { return new SqliteStatement(this._db.prepare(sql)); }
  exec(sql) { try { this._db.exec(sql); return Promise.resolve(); } catch (e) { return Promise.reject(e); } }
  close() { this._db.close(); }
  pragma(a, b) { this._db.pragma(a, b); }
}

// ─── DATABASE INITIALIZATION ──────────────────────────────────────────────

let _masterDb = null;
const _companyDbs = {};
let _isPg = false;

async function initMasterDb() {
  const db = _isPg
    ? await (async () => {
        const pool = await getPgPool();
        const d = new PgDatabase(pool);

        await d.exec(`
          CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('printing','advertising')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            phone TEXT, address TEXT, owner_name TEXT, currency TEXT DEFAULT 'SAR',
            currency_rate DOUBLE PRECISION DEFAULT 1.0, country TEXT DEFAULT 'SA',
            tax_number TEXT, logo_url TEXT
          );
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            full_name TEXT NOT NULL, email TEXT,
            role TEXT NOT NULL CHECK(role IN ('super_admin','manager','employee')),
            company_id TEXT, assigned_stages TEXT, phone TEXT, avatar TEXT,
            is_active INTEGER DEFAULT 1, token_version INTEGER DEFAULT 0, permissions TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(company_id) REFERENCES companies(id)
          );
          CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY, perm_key TEXT UNIQUE NOT NULL,
            name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
            module TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        const pc = await d.prepare('SELECT COUNT(*)::int as c FROM permissions').get();
        if (pc.c === 0) {
          let idx = 0;
          for (const mod of PERMISSIONS_TREE)
            for (const perm of mod.permissions)
              await d.prepare('INSERT INTO permissions (id, perm_key, name_ar, name_en, module) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING')
                .run(`perm_${idx++}`, `${mod.key}.${perm}`, `${mod.name_ar} - ${perm}`, `${mod.name_en} - ${perm}`, mod.key);
        }

        const cc = await d.prepare('SELECT COUNT(*)::int as c FROM companies').get();
        if (cc.c === 0) {
          const hash = bcrypt.hashSync('admin123', 10);
          const allPerms = getAllPermissionKeys().join(',');
          await d.exec("INSERT INTO companies (id, name, slug, type) VALUES ('comp_printing','المطبعة','printing','printing')");
          await d.exec("INSERT INTO companies (id, name, slug, type) VALUES ('comp_advertising','الوكالة الإعلانية','advertising','advertising')");
          await d.prepare("INSERT INTO users (id, username, password, full_name, email, role, permissions) VALUES ($1,$2,$3,$4,$5,'super_admin',$6)").run('u_super', 'admin', hash, 'المشرف الرئيسي', 'admin@printagent.com', allPerms);
          await d.prepare("INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES ($1,$2,$3,$4,$5,'manager',$6,$7)").run('u_print_mgr', 'mgr_print', hash, 'مدير المطبعة', 'mgr_print@printagent.com', 'comp_printing', allPerms);
          await d.prepare("INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES ($1,$2,$3,$4,$5,'manager',$6,$7)").run('u_adv_mgr', 'mgr_adv', hash, 'مدير الوكالة', 'mgr_adv@printagent.com', 'comp_advertising', allPerms);
          await d.prepare("INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES ($1,$2,$3,$4,$5,'employee',$6,$7)").run('u_emp1', 'emp1', hash, 'موظف 1', 'emp1@printagent.com', 'comp_printing', 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
          await d.prepare("INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES ($1,$2,$3,$4,$5,'employee',$6,$7)").run('u_emp2', 'emp2', hash, 'موظف 2', 'emp2@printagent.com', 'comp_advertising', 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
        } else {
          await d.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0");
          await d.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_name TEXT");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'SAR'");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency_rate DOUBLE PRECISION DEFAULT 1.0");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'SA'");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_number TEXT");
          await d.exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT");
        }

        return d;
      })()
    : (() => {
        const db = new Database(getDbPath('master'));
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
          CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('printing','advertising')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            full_name TEXT NOT NULL, email TEXT,
            role TEXT NOT NULL CHECK(role IN ('super_admin','manager','employee')),
            company_id TEXT, assigned_stages TEXT, phone TEXT, avatar TEXT,
            is_active INTEGER DEFAULT 1, token_version INTEGER DEFAULT 0, permissions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(company_id) REFERENCES companies(id)
          );
          CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY, perm_key TEXT UNIQUE NOT NULL,
            name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
            module TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        const permCount = db.prepare('SELECT COUNT(*) as c FROM permissions').get();
        if (permCount.c === 0) {
          const insert = db.prepare('INSERT OR IGNORE INTO permissions (id, perm_key, name_ar, name_en, module) VALUES (?,?,?,?,?)');
          let idx = 0;
          for (const mod of PERMISSIONS_TREE)
            for (const perm of mod.permissions)
              insert.run(`perm_${idx++}`, `${mod.key}.${perm}`, `${mod.name_ar} - ${perm}`, `${mod.name_en} - ${perm}`, mod.key);
        }

        const companies = db.prepare('SELECT COUNT(*) as c FROM companies').get();
        if (companies.c === 0) {
          const hash = bcrypt.hashSync('admin123', 10);
          const allPerms = getAllPermissionKeys().join(',');
          db.prepare('INSERT INTO companies (id, name, slug, type) VALUES (?,?,?,?)').run('comp_printing', 'المطبعة', 'printing', 'printing');
          db.prepare('INSERT INTO companies (id, name, slug, type) VALUES (?,?,?,?)').run('comp_advertising', 'الوكالة الإعلانية', 'advertising', 'advertising');
          db.prepare('INSERT INTO users (id, username, password, full_name, email, role, permissions) VALUES (?,?,?,?,?,?,?)').run('u_super', 'admin', hash, 'المشرف الرئيسي', 'admin@printagent.com', 'super_admin', allPerms);
          db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_print_mgr', 'mgr_print', hash, 'مدير المطبعة', 'mgr_print@printagent.com', 'manager', 'comp_printing', allPerms);
          db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_adv_mgr', 'mgr_adv', hash, 'مدير الوكالة', 'mgr_adv@printagent.com', 'manager', 'comp_advertising', allPerms);
          db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_emp1', 'emp1', hash, 'موظف 1', 'emp1@printagent.com', 'employee', 'comp_printing', 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
          db.prepare('INSERT INTO users (id, username, password, full_name, email, role, company_id, permissions) VALUES (?,?,?,?,?,?,?,?)').run('u_emp2', 'emp2', hash, 'موظف 2', 'emp2@printagent.com', 'employee', 'comp_advertising', 'dashboard.view,tasks.view,tasks.edit,attendance.clock,leave.view_own,leave.request,advances.view_own,advances.request,chat.view,chat.send,notifications.view');
        } else {
          try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"); } catch (e) {}
          try { db.exec("ALTER TABLE users ADD COLUMN permissions TEXT"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN phone TEXT"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN address TEXT"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN owner_name TEXT"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN currency TEXT DEFAULT 'SAR'"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN currency_rate REAL DEFAULT 1.0"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN country TEXT DEFAULT 'SA'"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN tax_number TEXT"); } catch (e) {}
          try { db.exec("ALTER TABLE companies ADD COLUMN logo_url TEXT"); } catch (e) {}
        }

        return new SqliteDatabase(db);
      })();

  return db;
}

async function initCompanyDb(slug) {
  if (_companyDbs[slug]) return _companyDbs[slug];

  const db = _isPg
    ? await (async () => {
        const pool = await getPgPool();
        const d = new PgDatabase(pool);

        await d.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT, full_name TEXT NOT NULL, email TEXT,
            role TEXT, assigned_stages TEXT, is_active INTEGER DEFAULT 1,
            company_slug TEXT DEFAULT ''
          );
          CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY, user_id TEXT UNIQUE, full_name TEXT NOT NULL, email TEXT,
            phone TEXT, position TEXT, base_salary DOUBLE PRECISION DEFAULT 0,
            hire_date TEXT, is_active INTEGER DEFAULT 1, assigned_stages TEXT,
            company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active',
            client_name TEXT, order_value DOUBLE PRECISION DEFAULT 0, down_payment DOUBLE PRECISION DEFAULT 0,
            request_date TEXT, request_type_id TEXT,
            execution_method TEXT DEFAULT 'internal' CHECK(execution_method IN ('internal','external','shared')),
            is_archived INTEGER DEFAULT 0, archive_reason TEXT, stage TEXT,
            company_slug TEXT DEFAULT '',
            created_by TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS request_types (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
            stage TEXT NOT NULL, assignee_id TEXT, priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
            due_date TEXT, is_outsourced INTEGER DEFAULT 0, outsourced_vendor TEXT,
            outsourced_cost DOUBLE PRECISION DEFAULT 0, outsourced_delivery_status TEXT DEFAULT 'pending',
            approved_by TEXT, approved_at TEXT, completed_at TEXT, created_by TEXT,
            company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(assignee_id) REFERENCES users(id), FOREIGN KEY(approved_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS task_comments (
            id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL,
            message TEXT NOT NULL, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id), FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS task_attachments (
            id TEXT PRIMARY KEY, task_id TEXT NOT NULL, file_name TEXT NOT NULL,
            file_path TEXT NOT NULL, uploaded_by TEXT, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id)
          );
          CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
            clock_in TEXT, clock_out TEXT, location_lat DOUBLE PRECISION, location_lng DOUBLE PRECISION,
            status TEXT DEFAULT 'present', company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS leave_requests (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('annual','sick','personal')),
            start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
            reviewed_by TEXT, reviewed_at TEXT, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(reviewed_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS salary_advances (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL,
            reason TEXT NOT NULL, repayment_terms TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
            reviewed_by TEXT, reviewed_at TEXT, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(reviewed_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS payroll (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL,
            base_salary DOUBLE PRECISION NOT NULL, deductions DOUBLE PRECISION DEFAULT 0,
            advances_deducted DOUBLE PRECISION DEFAULT 0, late_penalties DOUBLE PRECISION DEFAULT 0,
            net_salary DOUBLE PRECISION NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
            paid_at TEXT, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('sale','purchase')),
            invoice_number TEXT, vendor_client_name TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL,
            description TEXT, invoice_date TEXT, created_by TEXT,
            company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
            type TEXT DEFAULT 'info', is_read INTEGER DEFAULT 0, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS cash_transactions (
            id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('in','out')),
            amount DOUBLE PRECISION NOT NULL, description TEXT,
            reference_type TEXT, reference_id TEXT, category TEXT,
            created_by TEXT, company_slug TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await d.exec(`CREATE INDEX IF NOT EXISTS idx_cash_company_slug ON cash_transactions(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_cash_created_at ON cash_transactions(created_at)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_cash_company_created ON cash_transactions(company_slug, created_at)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_company_slug ON tasks(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_projects_company_slug ON projects(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_project_comments_task ON task_comments(task_id)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_employees_company_slug ON employees(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_company_slug ON attendance(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_leave_company_slug ON leave_requests(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_advances_company_slug ON salary_advances(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_company_slug ON invoices(company_slug)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
        await d.exec(`CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_slug)`);

        await d.exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
        await d.exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS archive_reason TEXT");
        await d.exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage TEXT");
        await d.exec("ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_stages TEXT");
        await d.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_stages TEXT");

        await d.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE request_types ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);
        await d.exec(`ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS company_slug TEXT DEFAULT ''`);

        await d.prepare('UPDATE projects SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE tasks SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE employees SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE users SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE attendance SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE leave_requests SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE salary_advances SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE payroll SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE invoices SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE notifications SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE task_comments SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE task_attachments SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE request_types SET company_slug = $1 WHERE company_slug = \'\'').run(slug);
        await d.prepare('UPDATE cash_transactions SET company_slug = $1 WHERE company_slug = \'\'').run(slug);

        const uc = await d.prepare('SELECT COUNT(*)::int as c FROM users').get();
        if (uc.c === 0) {
          const company = await _masterDb.prepare('SELECT * FROM companies WHERE slug = $1').get(slug);
          if (company) {
            const users = await _masterDb.prepare('SELECT id, username, full_name, email, role, is_active FROM users WHERE company_id = $1 OR role = \'super_admin\'').all(company.id);
            for (const u of users)
              await d.prepare('INSERT INTO users (id, username, full_name, email, role, is_active, company_slug) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING')
                .run(u.id, u.username, u.full_name, u.email, u.role, u.is_active, slug);
          }
        }

        const tc = await d.prepare('SELECT COUNT(*)::int as c FROM request_types').get();
        if (tc.c === 0) {
          const types = ['ورقيات', 'فلكس', 'أختام', 'بنرات', 'بروشورات', 'كتب', 'مجلات', 'ملصقات', 'بطاقات', 'مطويات', 'لوحات إعلانية', 'تصميم جرافيك', 'تغليف', 'هدايا دعائية', 'أخرى'];
          for (let i = 0; i < types.length; i++)
            await d.prepare('INSERT INTO request_types (id, name, company_slug) VALUES ($1,$2,$3)').run('rt_' + i, types[i], slug);
        }

        return d;
      })()
    : await (async () => {
        const db = new Database(getDbPath(slug));
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT, full_name TEXT NOT NULL, email TEXT,
            role TEXT, assigned_stages TEXT, is_active INTEGER DEFAULT 1,
            company_slug TEXT DEFAULT ''
          );
          CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY, user_id TEXT UNIQUE, full_name TEXT NOT NULL, email TEXT,
            phone TEXT, position TEXT, base_salary REAL DEFAULT 0,
            hire_date TEXT, is_active INTEGER DEFAULT 1, assigned_stages TEXT,
            company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active',
            client_name TEXT, order_value REAL DEFAULT 0, down_payment REAL DEFAULT 0,
            request_date TEXT, request_type_id TEXT,
            execution_method TEXT DEFAULT 'internal' CHECK(execution_method IN ('internal','external','shared')),
            is_archived INTEGER DEFAULT 0, archive_reason TEXT, stage TEXT,
            company_slug TEXT DEFAULT '',
            created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS request_types (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
            stage TEXT NOT NULL, assignee_id TEXT, priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
            due_date TEXT, is_outsourced INTEGER DEFAULT 0, outsourced_vendor TEXT,
            outsourced_cost REAL DEFAULT 0, outsourced_delivery_status TEXT DEFAULT 'pending',
            approved_by TEXT, approved_at TEXT, completed_at TEXT, created_by TEXT,
            company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(assignee_id) REFERENCES users(id), FOREIGN KEY(approved_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS task_comments (
            id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL,
            message TEXT NOT NULL, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id), FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS task_attachments (
            id TEXT PRIMARY KEY, task_id TEXT NOT NULL, file_name TEXT NOT NULL,
            file_path TEXT NOT NULL, uploaded_by TEXT, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id)
          );
          CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
            clock_in TEXT, clock_out TEXT, location_lat REAL, location_lng REAL,
            status TEXT DEFAULT 'present', company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS leave_requests (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('annual','sick','personal')),
            start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
            reviewed_by TEXT, reviewed_at TEXT, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(reviewed_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS salary_advances (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
            reason TEXT NOT NULL, repayment_terms TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
            reviewed_by TEXT, reviewed_at TEXT, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(reviewed_by) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS payroll (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL,
            base_salary REAL NOT NULL, deductions REAL DEFAULT 0,
            advances_deducted REAL DEFAULT 0, late_penalties REAL DEFAULT 0,
            net_salary REAL NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
            paid_at TEXT, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('sale','purchase')),
            invoice_number TEXT, vendor_client_name TEXT NOT NULL, amount REAL NOT NULL,
            description TEXT, invoice_date TEXT, created_by TEXT,
            company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
            type TEXT DEFAULT 'info', is_read INTEGER DEFAULT 0, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS cash_transactions (
            id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('in','out')),
            amount REAL NOT NULL, description TEXT,
            reference_type TEXT, reference_id TEXT, category TEXT,
            created_by TEXT, company_slug TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_company_slug ON cash_transactions(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_created_at ON cash_transactions(created_at)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_company_created ON cash_transactions(company_slug, created_at)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_company_slug ON tasks(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_company_slug ON projects(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_project_comments_task ON task_comments(task_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_company_slug ON employees(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_company_slug ON attendance(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_leave_company_slug ON leave_requests(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_advances_company_slug ON salary_advances(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_company_slug ON invoices(company_slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_slug)`);

        try { db.exec("ALTER TABLE projects ADD COLUMN is_archived INTEGER DEFAULT 0"); } catch (e) {}
        try { db.exec("ALTER TABLE projects ADD COLUMN archive_reason TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE projects ADD COLUMN stage TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE employees ADD COLUMN assigned_stages TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE users ADD COLUMN assigned_stages TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE users ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE employees ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE projects ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE request_types ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE tasks ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE task_comments ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE task_attachments ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE attendance ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE leave_requests ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE salary_advances ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE payroll ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE invoices ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE notifications ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}
        try { db.exec("ALTER TABLE cash_transactions ADD COLUMN company_slug TEXT DEFAULT ''"); } catch (e) {}

        const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
        if (usersCount.c === 0) {
          const company = _masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(slug);
          if (company) {
            const companyUsers = _masterDb.prepare('SELECT id, username, full_name, email, role, is_active FROM users WHERE company_id = ? OR role = ?').all(company.id, 'super_admin') || [];
            for (const u of companyUsers)
              db.prepare('INSERT OR IGNORE INTO users (id, username, full_name, email, role, is_active) VALUES (?,?,?,?,?,?)').run(u.id, u.username, u.full_name, u.email, u.role, u.is_active);
          }
        }

        const typeCount = db.prepare("SELECT COUNT(*) as c FROM request_types").get();
        if (typeCount.c === 0) {
          const types = ['ورقيات', 'فلكس', 'أختام', 'بنرات', 'بروشورات', 'كتب', 'مجلات', 'ملصقات', 'بطاقات', 'مطويات', 'لوحات إعلانية', 'تصميم جرافيك', 'تغليف', 'هدايا دعائية', 'أخرى'];
          const insert = db.prepare('INSERT INTO request_types (id, name, company_slug) VALUES (?,?,?)');
          types.forEach((name, i) => insert.run('rt_' + i, name, slug));
        }

        return new SqliteDatabase(db);
      })();

  _companyDbs[slug] = db;
  return db;
}

// ─── EXPORTED API ─────────────────────────────────────────────────────────

export async function initDatabase() {
  _isPg = !!process.env.DATABASE_URL;
  _masterDb = await initMasterDb();
  return _masterDb;
}

export function getMasterDb() {
  return _masterDb;
}

export function getCompanyDb(slug) {
  if (!_companyDbs[slug]) throw new Error(`Company "${slug}" DB not initialized. Call initCompanyDb() first.`);
  return _companyDbs[slug];
}

export { initCompanyDb, getDbPath };

export async function closeAll() {
  if (_masterDb) await _masterDb.close();
  for (const db of Object.values(_companyDbs)) await db.close();
  if (_pgPool) await _pgPool.end();
}
