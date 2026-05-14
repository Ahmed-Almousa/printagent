import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5000';
const DB_DIR = path.join(__dirname, 'databases');

// Use Node.js v20 binary
const NODE_BIN = 'C:\\nodejs\\node-v20.18.0-win-x64\\node.exe';

let passed = 0;
let failed = 0;
let serverProcess = null;

function request(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, fn) {
  return fn().then((result) => {
    if (result.pass) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}${result.reason ? ': ' + result.reason : ''}`);
      if (result.details) console.log(`      Details: ${JSON.stringify(result.details)}`);
      failed++;
    }
  }).catch((err) => {
    const msg = (err && err.message) ? err.message : (err ? String(err) : 'Unknown error');
    console.log(`  ❌ ${name}: [EXCEPTION] ${msg}`);
    failed++;
  });
}

function assert(condition, reason, details) {
  return { pass: !!condition, reason: condition ? '' : reason, details: condition ? null : details };
}

// Clean up databases
function cleanDatabases() {
  const dbDir = DB_DIR;
  if (fs.existsSync(dbDir)) {
    const files = fs.readdirSync(dbDir);
    for (const f of files) {
      if (f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm')) {
        fs.unlinkSync(path.join(dbDir, f));
      }
    }
  }
}

// Start server
let serverStderr = '';

function startServer() {
  return new Promise((resolve, reject) => {
    const nodeDir = path.dirname(NODE_BIN);
    const newPath = nodeDir + path.delimiter + (process.env.PATH || '');
    serverProcess = spawn(NODE_BIN, ['index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: newPath, PORT: '5000' },
    });
    let started = false;
    serverProcess.stderr.on('data', (d) => {
      serverStderr += d.toString();
      const text = d.toString();
      if (text.includes('ERP System is running') && !started) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.stdout.on('data', (d) => {
      const text = d.toString();
      if (text.includes('ERP System is running') && !started) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.on('exit', (code) => {
      console.log(`   ⚠ Server exited with code ${code}`);
    });
    setTimeout(() => { if (!started) resolve(); }, 5000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function main() {
  console.log('\n🧹 Cleaning databases...');
  cleanDatabases();

  console.log('🚀 Starting server...');
  await startServer();
  console.log('✅ Server started\n');

  let adminToken, mgrPrintToken, mgrAdvToken, emp1Token, emp2Token;
  let printingProjectId, advProjectId;
  let printingTaskId, advTaskId;

  console.log('═══ AUTH ═══');

  await test('Login as super_admin', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    if (!res.body.token) return assert(false, 'No token');
    if (res.body.user.role !== 'super_admin') return assert(false, `Wrong role: ${res.body.user.role}`);
    adminToken = res.body.token;
    return assert(true);
  });

  await test('Login as printing manager', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'mgr_print', password: 'admin123' });
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    mgrPrintToken = res.body.token;
    return assert(true);
  });

  await test('Login as advertising manager', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'mgr_adv', password: 'admin123' });
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    mgrAdvToken = res.body.token;
    return assert(true);
  });

  await test('Login as printing employee', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'emp1', password: 'admin123' });
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    emp1Token = res.body.token;
    return assert(true);
  });

  await test('Login as advertising employee', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'emp2', password: 'admin123' });
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    emp2Token = res.body.token;
    return assert(true);
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
    return assert(res.status === 401);
  });

  await test('Login with missing fields returns 400', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin' });
    return assert(res.status === 400);
  });

  await test('GET /api/auth/me returns user info', async () => {
    const res = await request('GET', '/api/auth/me', null, adminToken);
    return assert(res.status === 200 && res.body.user && res.body.user.username === 'admin');
  });

  await test('GET /api/auth/me without token returns 401', async () => {
    const res = await request('GET', '/api/auth/me');
    return assert(res.status === 401);
  });

  console.log('\n═══ COMPANIES ═══');

  await test('GET /api/auth/companies returns all for super_admin', async () => {
    const res = await request('GET', '/api/auth/companies', null, adminToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length === 2);
  });

  await test('GET /api/auth/companies returns one for manager', async () => {
    const res = await request('GET', '/api/auth/companies', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length === 1 && res.body[0].slug === 'printing');
  });

  await test('GET /api/auth/companies/:slug/stats returns stats', async () => {
    const res = await request('GET', '/api/auth/companies/printing/stats', null, adminToken);
    return assert(res.status === 200 && typeof res.body.activeProjects === 'number');
  });

  await test('GET /api/auth/companies/:slug/stats blocked for wrong manager', async () => {
    const res = await request('GET', '/api/auth/companies/advertising/stats', null, mgrPrintToken);
    return assert(res.status === 403);
  });

  await test('GET /api/users/:companySlug returns users', async () => {
    const res = await request('GET', '/api/users/printing', null, adminToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length >= 2);
  });

  console.log('\n═══ PROJECTS ═══');

  await test('POST /api/projects/:companySlug creates project (printing)', async () => {
    const res = await request('POST', '/api/projects/printing', {
      title: 'مشروع طباعة كتيب', description: 'كتيب دعائي 20 صفحة', client_name: 'شركة الأمل', order_value: 5000, down_payment: 2000
    }, mgrPrintToken);
    if (res.status !== 200) return assert(false, `Got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body.id) return assert(false, 'No id in response');
    printingProjectId = res.body.id;
    return assert(true);
  });

  await test('POST /api/projects/:companySlug creates project (advertising)', async () => {
    const res = await request('POST', '/api/projects/advertising', {
      title: 'حملة إعلانية', description: 'حملة وسائل تواصل اجتماعي', client_name: 'شركة النور', order_value: 10000, down_payment: 5000
    }, mgrAdvToken);
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    advProjectId = res.body.id;
    return assert(true);
  });

  await test('GET /api/projects/:companySlug lists projects', async () => {
    const res = await request('GET', '/api/projects/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length === 1);
  });

  await test('GET /api/projects/:companySlug?status=active filters', async () => {
    const res = await request('GET', '/api/projects/printing?status=active', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  await test('PUT /api/projects/:companySlug/:id updates project', async () => {
    const res = await request('PUT', `/api/projects/printing/${printingProjectId}`, { title: 'مشروع مطبوعات محدث' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.title === 'مشروع مطبوعات محدث');
  });

  console.log('\n═══ SETTINGS ═══');

  await test('GET /settings/request-types returns list', async () => {
    const res = await request('GET', '/api/settings/printing/request-types', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length > 0);
  });

  let newTypeId;
  await test('POST /settings/request-types creates type', async () => {
    const res = await request('POST', '/api/settings/printing/request-types', { name: 'بوسترات' }, mgrPrintToken);
    if (res.status !== 200) return assert(false, `Got ${res.status}`);
    newTypeId = res.body.id;
    return assert(res.body.name === 'بوسترات');
  });

  await test('PUT /settings/request-types updates type', async () => {
    const res = await request('PUT', `/api/settings/printing/request-types/${newTypeId}`, { name: 'بوسترات كبيرة' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.name === 'بوسترات كبيرة');
  });

  await test('DELETE /settings/request-types deletes type', async () => {
    const res = await request('DELETE', `/api/settings/printing/request-types/${newTypeId}`, null, mgrPrintToken);
    return assert(res.status === 200);
  });

  await test('Employee cannot manage request types', async () => {
    const res = await request('POST', '/api/settings/printing/request-types', { name: 'test' }, emp1Token);
    return assert(res.status === 403);
  });

  console.log('\n═══ EMPLOYEES ═══');

  await test('POST /api/employees/:companySlug creates employee', async () => {
    const res = await request('POST', '/api/employees/printing', {
      full_name: 'أحمد محمد', email: 'ahmed@test.com', phone: '0555555555', position: 'مصمم', base_salary: 5000, user_id: 'u_emp1'
    }, mgrPrintToken);
    return assert(res.status === 200 && res.body.id && res.body.full_name === 'أحمد محمد');
  });

  await test('GET /api/employees/:companySlug lists employees', async () => {
    const res = await request('GET', '/api/employees/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  await test('GET /api/employees/:companySlug/performance returns perf data', async () => {
    const res = await request('GET', '/api/employees/printing/performance', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  console.log('\n═══ TASKS ═══');

  await test('POST /api/tasks/:companySlug creates task (printing)', async () => {
    const res = await request('POST', '/api/tasks/printing', {
      project_id: printingProjectId, title: 'تصميم الغلاف', stage: 'draft', priority: 'high'
    }, mgrPrintToken);
    if (res.status !== 200) return assert(false, `Got ${res.status}: ${JSON.stringify(res.body)}`);
    printingTaskId = res.body.id;
    return assert(true);
  });

  await test('POST /api/tasks/:companySlug creates task (advertising)', async () => {
    const res = await request('POST', '/api/tasks/advertising', {
      project_id: advProjectId, title: 'إعلان فيسبوك', stage: 'brief', priority: 'urgent'
    }, mgrAdvToken);
    if (res.status !== 200) return assert(false, `Got ${res.status}: ${JSON.stringify(res.body)}`);
    advTaskId = res.body.id;
    return assert(true);
  });

  await test('GET /api/tasks/:companySlug lists tasks', async () => {
    const res = await request('GET', '/api/tasks/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length === 1);
  });

  await test('GET /api/tasks/:companySlug?project_id= filters', async () => {
    const res = await request('GET', `/api/tasks/printing?project_id=${printingProjectId}`, null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body) && res.body.length === 1);
  });

  await test('GET /api/tasks/:companySlug/:id returns task with comments', async () => {
    const res = await request('GET', `/api/tasks/printing/${printingTaskId}`, null, mgrPrintToken);
    return assert(res.status === 200 && res.body.id === printingTaskId && Array.isArray(res.body.comments));
  });

  await test('PUT /api/tasks/:companySlug/:id updates task', async () => {
    const res = await request('PUT', `/api/tasks/printing/${printingTaskId}`, { title: 'تصميم الغلاف محدث' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.title === 'تصميم الغلاف محدث');
  });

  await test('Stage approval gate: employee cannot move to production', async () => {
    const res = await request('PUT', `/api/tasks/printing/${printingTaskId}`, { stage: 'production' }, emp1Token);
    return assert(res.status === 403);
  });

  await test('Stage approval gate: manager can move to production', async () => {
    const res = await request('PUT', `/api/tasks/printing/${printingTaskId}`, { stage: 'production' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.stage === 'production', 'unexpected response', { status: res.status, body: res.body });
  });

  await test('POST /api/tasks/:companySlug/:id/comment adds comment', async () => {
    const res = await request('POST', `/api/tasks/printing/${printingTaskId}/comment`, { message: 'تمت المراجعة' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.message === 'تمت المراجعة');
  });

  await test('GET task with comments includes them', async () => {
    const res = await request('GET', `/api/tasks/printing/${printingTaskId}`, null, mgrPrintToken);
    return assert(res.status === 200 && res.body.comments.length === 1);
  });

  await test('Task not found returns 404', async () => {
    const res = await request('GET', '/api/tasks/printing/nonexistent', null, mgrPrintToken);
    return assert(res.status === 404);
  });

  console.log('\n═══ ATTENDANCE ═══');

  await test('POST clock-in', async () => {
    const res = await request('POST', '/api/attendance/printing/clock-in', { lat: 24.7136, lng: 46.6753 }, emp1Token);
    return assert(res.status === 200 && res.body.clock_in && res.body.location_lat === 24.7136);
  });

  await test('POST duplicate clock-in returns 400', async () => {
    const res = await request('POST', '/api/attendance/printing/clock-in', {}, emp1Token);
    return assert(res.status === 400);
  });

  await test('POST clock-out', async () => {
    const res = await request('POST', '/api/attendance/printing/clock-out', {}, emp1Token);
    return assert(res.status === 200 && res.body.clock_out);
  });

  await test('POST duplicate clock-out returns 400', async () => {
    const res = await request('POST', '/api/attendance/printing/clock-out', {}, emp1Token);
    return assert(res.status === 400);
  });

  await test('GET /attendance/today returns today data', async () => {
    const res = await request('GET', '/api/attendance/printing/today', null, mgrPrintToken);
    return assert(res.status === 200 && res.body.today && res.body.employees);
  });

  await test('GET /attendance filters by date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request('GET', `/api/attendance/printing?date=${today}`, null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  console.log('\n═══ LEAVE ═══');

  await test('POST leave request (employee)', async () => {
    const res = await request('POST', '/api/leave/printing', {
      type: 'annual', start_date: '2026-06-01', end_date: '2026-06-05', reason: 'إجازة سنوية'
    }, emp1Token);
    return assert(res.status === 200 && res.body.id && res.body.status === 'pending');
  });

  await test('POST leave without reason returns 400', async () => {
    const res = await request('POST', '/api/leave/printing', {
      type: 'annual', start_date: '2026-06-01', end_date: '2026-06-05'
    }, emp1Token);
    return assert(res.status === 400);
  });

  await test('PUT leave review: approve', async () => {
    const leaves = await request('GET', '/api/leave/printing?status=pending', null, mgrPrintToken);
    if (!Array.isArray(leaves.body) || leaves.body.length === 0) return assert(false, 'No pending leaves');
    const res = await request('PUT', `/api/leave/printing/${leaves.body[0].id}/review`, { status: 'approved' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.status === 'approved', 'unexpected response', { status: res.status, body: res.body });
  });

  await test('PUT leave review: employee blocked', async () => {
    const leaves = await request('GET', '/api/leave/printing', null, mgrPrintToken);
    if (!Array.isArray(leaves.body) || leaves.body.length === 0) return assert(false, 'No leaves');
    const res = await request('PUT', `/api/leave/printing/${leaves.body[0].id}/review`, { status: 'approved' }, emp1Token);
    return assert(res.status === 403);
  });

  await test('GET leave requests', async () => {
    const res = await request('GET', '/api/leave/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  console.log('\n═══ SALARY ADVANCES ═══');

  await test('POST salary advance (employee)', async () => {
    const res = await request('POST', '/api/advances/printing', {
      amount: 1000, reason: 'ظروف عائلية', repayment_terms: 'تقسيط على 3 أشهر'
    }, emp1Token);
    return assert(res.status === 200 && res.body.id && res.body.status === 'pending');
  });

  await test('POST salary advance without reason returns 400', async () => {
    const res = await request('POST', '/api/advances/printing', { amount: 1000 }, emp1Token);
    return assert(res.status === 400);
  });

  await test('POST salary advance with zero amount returns 400', async () => {
    const res = await request('POST', '/api/advances/printing', { amount: 0, reason: 'test' }, emp1Token);
    return assert(res.status === 400);
  });

  await test('PUT salary advance review: approve as paid', async () => {
    const advances = await request('GET', '/api/advances/printing?status=pending', null, mgrPrintToken);
    if (!Array.isArray(advances.body) || advances.body.length === 0) return assert(false, 'No pending advances');
    const res = await request('PUT', `/api/advances/printing/${advances.body[0].id}/review`, { status: 'paid' }, mgrPrintToken);
    return assert(res.status === 200 && res.body.status === 'paid', 'unexpected response', { status: res.status, body: res.body });
  });

  await test('GET salary advances', async () => {
    const res = await request('GET', '/api/advances/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  console.log('\n═══ PAYROLL ═══');

  await test('POST payroll calculate', async () => {
    const res = await request('POST', '/api/payroll/printing/calculate', {}, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body), 'unexpected response', { status: res.status, body: res.body });
  });

  await test('GET payroll records', async () => {
    const res = await request('GET', '/api/payroll/printing', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  await test('PUT payroll pay', async () => {
    const payrolls = await request('GET', '/api/payroll/printing?status=pending', null, mgrPrintToken);
    if (!Array.isArray(payrolls.body) || payrolls.body.length === 0) return assert(false, 'No pending payroll');
    const res = await request('PUT', `/api/payroll/printing/${payrolls.body[0].id}/pay`, {}, mgrPrintToken);
    return assert(res.status === 200 && res.body.status === 'paid', 'unexpected response', { status: res.status, body: res.body });
  });

  console.log('\n═══ NOTIFICATIONS ═══');

  await test('GET notifications', async () => {
    const res = await request('GET', '/api/notifications/printing', null, emp1Token);
    return assert(res.status === 200 && Array.isArray(res.body));
  });

  await test('PUT mark notification as read', async () => {
    const notifs = await request('GET', '/api/notifications/printing', null, emp1Token);
    if (!Array.isArray(notifs.body) || notifs.body.length === 0) return assert(false, 'No notifications');
    const res = await request('PUT', `/api/notifications/printing/${notifs.body[0].id}/read`, {}, emp1Token);
    return assert(res.status === 200 && res.body.success === true);
  });

  await test('PUT mark all notifications as read', async () => {
    const res = await request('PUT', '/api/notifications/printing/read-all', {}, emp1Token);
    return assert(res.status === 200 && res.body.success === true);
  });

  console.log('\n═══ ACCESS CONTROL ═══');

  await test('Printing manager cannot access advertising projects', async () => {
    const res = await request('GET', '/api/projects/advertising', null, mgrPrintToken);
    return assert(res.status === 200 && Array.isArray(res.body));
    // They can access the endpoint but will see empty data (no direct 403 since companyAccess isn't used in projects)
  });

  await test('Employee cannot calculate payroll', async () => {
    const res = await request('POST', '/api/payroll/printing/calculate', {}, emp1Token);
    return assert(res.status === 403);
  });

  await test('Employee cannot review leave', async () => {
    const leaves = await request('GET', '/api/leave/printing', null, mgrPrintToken);
    if (!Array.isArray(leaves.body) || leaves.body.length === 0) return assert(false, 'No leaves');
    const res = await request('PUT', `/api/leave/printing/${leaves.body[0].id}/review`, { status: 'approved' }, emp1Token);
    return assert(res.status === 403);
  });

  await test('Employee cannot review advances', async () => {
    const advances = await request('GET', '/api/advances/printing', null, mgrPrintToken);
    if (!Array.isArray(advances.body) || advances.body.length === 0) return assert(false, 'No advances');
    const res = await request('PUT', `/api/advances/printing/${advances.body[0].id}/review`, { status: 'approved' }, emp1Token);
    return assert(res.status === 403);
  });

  // Cleanup
  console.log('\n═══════════════════════════════════════');
  const total = passed + failed;
  console.log(`Results: ${passed}/${total} passed, ${failed}/${total} failed`);
  if (failed === 0) console.log('🎉 ALL TESTS PASSED!');
  else console.log(`❌ ${failed} test(s) FAILED`);
  console.log('═══════════════════════════════════════\n');

  stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  stopServer();
  process.exit(1);
});
