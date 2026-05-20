import { Router } from 'express';
import { getCompanyDb, getMasterDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/:companySlug', authenticate, async (req, res) => {
  try {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  const slug = req.params.companySlug;
  const masterDb = getMasterDb();
  const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(slug);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const db = getCompanyDb(slug);
  const isPrint = slug === 'printing';
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Clear existing seed data
  for (const table of ['cash_transactions', 'invoices', 'payroll', 'salary_advances', 'leave_requests', 'attendance', 'task_attachments', 'task_comments', 'tasks', 'projects', 'employees', 'notifications']) {
    await db.prepare(`DELETE FROM ${table} WHERE company_slug = ?`).run(slug);
  }

  // ── Employees ──
  const employees = [];
  const empData = isPrint ? [
    { id: 'emp_print_01', user_id: 'u_print_mgr', full_name: 'أحمد المدير', position: 'مدير المطبعة', salary: 8000 },
    { id: 'emp_print_02', user_id: null, full_name: 'خالد المصمم', position: 'مصمم جرافيك', salary: 5000 },
    { id: 'emp_print_03', user_id: null, full_name: 'فهد الطباع', position: 'مشغل طباعة', salary: 4000 },
    { id: 'emp_print_04', user_id: 'u_emp1', full_name: 'محمد التشطيب', position: 'مشرف تشطيب', salary: 4500 },
    { id: 'emp_print_05', user_id: null, full_name: 'سعود المستودع', position: 'أمين مستودع', salary: 3500 },
  ] : [
    { id: 'emp_adv_01', user_id: 'u_adv_mgr', full_name: 'سارة المديرة', position: 'مديرة الوكالة', salary: 9000 },
    { id: 'emp_adv_02', user_id: null, full_name: 'ليلى المصممة', position: 'مصممة جرافيك', salary: 5500 },
    { id: 'emp_adv_03', user_id: 'u_emp2', full_name: 'نور الحسابات', position: 'محاسبة', salary: 5000 },
    { id: 'emp_adv_04', user_id: null, full_name: 'ماجد المنسق', position: 'منسق حملات', salary: 4500 },
  ];
  const empInsert = db.prepare(`INSERT INTO employees (id, user_id, full_name, email, phone, position, base_salary, hire_date, is_active, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
  for (const e of empData) {
    empInsert.run(e.id, e.user_id, e.full_name, `${e.id}@test.com`, '0555000' + e.id.slice(-2), e.position, e.salary, '2025-01-01', slug, now);
    employees.push(e);
  }

  // ── Projects & Tasks ──
  const projInsert = db.prepare(`INSERT INTO projects (id, title, description, client_name, order_value, down_payment, status, stage, is_archived, created_by, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`);
  const taskInsert = db.prepare(`INSERT INTO tasks (id, project_id, title, description, stage, assignee_id, priority, due_date, created_by, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const commentInsert = db.prepare(`INSERT INTO task_comments (id, task_id, user_id, message, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);

  if (isPrint) {
    // Project 1: completed
    await projInsert.run('proj_seed_p1', 'كتيب إعلاني لشركة الأمل', 'تصميم وطباعة كتيب إعلاني بكمية 500 نسخة', 'شركة الأمل للتجارة', 5000, 5000, 'active', 'delivered', 'u_print_mgr', slug, '2026-01-15 09:00:00');
    const p1Tasks = [
      { id: 'task_p1_01', stage: 'draft', assignee: 'emp_print_02', title: 'إعداد المسودة الأولية' },
      { id: 'task_p1_02', stage: 'design_review', assignee: 'emp_print_01', title: 'مراجعة التصميم' },
      { id: 'task_p1_03', stage: 'production', assignee: 'emp_print_03', title: 'طباعة الكتيب' },
      { id: 'task_p1_04', stage: 'finishing', assignee: 'emp_print_04', title: 'تشطيب وتجليد' },
      { id: 'task_p1_05', stage: 'ready_pickup', assignee: 'emp_print_05', title: 'تجهيز للاستلام' },
      { id: 'task_p1_06', stage: 'delivered', assignee: 'emp_print_05', title: 'تم التسليم للعميل' },
    ];
    for (const t of p1Tasks) {
      const d = new Date('2026-01-15'); d.setDate(d.getDate() + p1Tasks.indexOf(t) * 5);
      await taskInsert.run(t.id, 'proj_seed_p1', t.title, '', t.stage, t.assignee, 'medium', d.toISOString().slice(0,10), 'u_print_mgr', slug, d.toISOString().slice(0,19));
    }
    await commentInsert.run('comm_p1_01', 'task_p1_02', 'u_print_mgr', 'تمت المراجعة، التصميم ممتاز', slug, '2026-01-20 10:30:00');
    await commentInsert.run('comm_p1_02', 'task_p1_02', 'emp_print_02', 'شكراً، تم تعديل الألوان حسب الطلب', slug, '2026-01-20 11:00:00');

    // Project 2: in production
    await projInsert.run('proj_seed_p2', 'تصميم وطباعة بروشورات لمؤسسة النور', 'بروشور دعائي مقاس A4 ثلاثي الطي', 'مؤسسة النور الخيرية', 3000, 1000, 'active', 'production', 'u_print_mgr', slug, '2026-03-01 08:00:00');
    const p2Tasks = [
      { id: 'task_p2_01', stage: 'draft', assignee: 'emp_print_02', title: 'إعداد المسودة' },
      { id: 'task_p2_02', stage: 'design_review', assignee: 'emp_print_01', title: 'مراجعة التصميم' },
      { id: 'task_p2_03', stage: 'production', assignee: 'emp_print_03', title: 'طباعة البروشورات' },
    ];
    for (const t of p2Tasks) {
      const d = new Date('2026-03-01'); d.setDate(d.getDate() + p2Tasks.indexOf(t) * 3);
      await taskInsert.run(t.id, 'proj_seed_p2', t.title, '', t.stage, t.assignee, 'high', d.toISOString().slice(0,10), 'u_print_mgr', slug, d.toISOString().slice(0,19));
    }

    // Project 3: draft (not yet in tasks)
    await projInsert.run('proj_seed_p3', 'لافتات إعلانية لمجمع التحلية التجاري', 'تصميم وطباعة لافتات كبيرة للمجمع', 'مجمع التحلية التجاري', 8000, 0, 'pending', null, 'u_print_mgr', slug, '2026-05-10 10:00:00');

    // Project 4: cancelled
    await projInsert.run('proj_seed_p4', 'طباعة كروبات لمطعم النخبة', 'طباعة 1000 كارت شخصي', 'مطعم النخبة', 1500, 0, 'cancelled', 'cancelled', 'u_print_mgr', slug, '2026-02-01 09:00:00');
    await taskInsert.run('task_p4_01', 'proj_seed_p4', 'إعداد المسودة', '', 'cancelled', 'emp_print_02', 'low', '2026-02-05', 'u_print_mgr', slug, '2026-02-01 09:00:00');
  } else {
    // Project 1: completed
    await projInsert.run('proj_seed_a1', 'حملة إعلانية لمطعم كرم', 'حملة تسويقية متكاملة بمناسبة افتتاح الفرع الجديد', 'مطعم كرم', 15000, 15000, 'active', 'delivered', 'u_adv_mgr', slug, '2026-02-01 11:00:00');
    const a1Tasks = [
      { id: 'task_a1_01', stage: 'brief', assignee: 'emp_adv_04', title: 'استلام الموجز من العميل' },
      { id: 'task_a1_02', stage: 'concept_design', assignee: 'emp_adv_02', title: 'تصميم المفاهيم الإبداعية' },
      { id: 'task_a1_03', stage: 'client_feedback', assignee: 'emp_adv_01', title: 'عرض التصاميم على العميل' },
      { id: 'task_a1_04', stage: 'launch', assignee: 'emp_adv_04', title: 'إطلاق الحملة' },
      { id: 'task_a1_05', stage: 'delivered', assignee: 'emp_adv_03', title: 'تسليم تقارير الحملة' },
    ];
    for (const t of a1Tasks) {
      const d = new Date('2026-02-01'); d.setDate(d.getDate() + a1Tasks.indexOf(t) * 7);
      await taskInsert.run(t.id, 'proj_seed_a1', t.title, '', t.stage, t.assignee, 'high', d.toISOString().slice(0,10), 'u_adv_mgr', slug, d.toISOString().slice(0,19));
    }

    // Project 2: in concept_design
    await projInsert.run('proj_seed_a2', 'تصميم هوية بصرية لشركة وادي التقنية', 'هوية متكاملة شامل شعار وبطاقات وقرطاسية', 'شركة وادي التقنية', 12000, 3000, 'active', 'concept_design', 'u_adv_mgr', slug, '2026-04-15 09:00:00');
    const a2Tasks = [
      { id: 'task_a2_01', stage: 'brief', assignee: 'emp_adv_04', title: 'استلام الموجز' },
      { id: 'task_a2_02', stage: 'concept_design', assignee: 'emp_adv_02', title: 'تصميم الهوية' },
    ];
    for (const t of a2Tasks) {
      const d = new Date('2026-04-15'); d.setDate(d.getDate() + a2Tasks.indexOf(t) * 5);
      await taskInsert.run(t.id, 'proj_seed_a2', t.title, '', t.stage, t.assignee, 'urgent', d.toISOString().slice(0,10), 'u_adv_mgr', slug, d.toISOString().slice(0,19));
    }

    // Project 3: pending
    await projInsert.run('proj_seed_a3', 'إعلان تلفزيوني لمتجر أزياء', 'إنتاج إعلان تلفزيوني مدته 30 ثانية', 'متجر أزياء الفخامة', 25000, 0, 'pending', null, 'u_adv_mgr', slug, '2026-05-18 14:00:00');
  }

  // ── Cash Transactions ──
  const cashInsert = db.prepare(`INSERT INTO cash_transactions (id, type, amount, description, reference_type, reference_id, category, created_by, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const today = now.slice(0, 10);
  const cashEntries = isPrint ? [
    { type: 'in', amount: 5000, desc: 'دفعة على حساب مشروع الأمل', ref: 'project_down_payment', refId: 'proj_seed_p1', cat: 'مبيعات', date: '2026-01-15 09:00:00' },
    { type: 'in', amount: 1000, desc: 'دفعة على حساب مشروع النور', ref: 'project_down_payment', refId: 'proj_seed_p2', cat: 'مبيعات', date: '2026-03-01 08:00:00' },
    { type: 'out', amount: 1500, desc: 'شراء ورق ومواد طباعة', ref: null, refId: null, cat: 'مشتريات', date: '2026-01-20 10:00:00' },
    { type: 'out', amount: 2000, desc: 'صيانة ماكينة الطباعة', ref: null, refId: null, cat: 'مصاريف تشغيل', date: '2026-03-15 09:00:00' },
    { type: 'in', amount: 4000, desc: 'باقي قيمة مشروع الأمل', ref: 'project_final_payment', refId: 'proj_seed_p1', cat: 'مبيعات', date: '2026-02-15 11:00:00' },
    { type: 'in', amount: 200, desc: 'مقبوضات نقدية متنوعة', ref: null, refId: null, cat: 'مبيعات', date: today + ' 09:30:00' },
    { type: 'out', amount: 500, desc: 'قرطاسية ومستلزمات مكتبية', ref: null, refId: null, cat: 'مصاريف إدارية', date: today + ' 14:00:00' },
  ] : [
    { type: 'in', amount: 15000, desc: 'دفعة على حساب حملة كرم', ref: 'project_down_payment', refId: 'proj_seed_a1', cat: 'مبيعات', date: '2026-02-01 11:00:00' },
    { type: 'in', amount: 3000, desc: 'دفعة على حساب هوية وادي', ref: 'project_down_payment', refId: 'proj_seed_a2', cat: 'مبيعات', date: '2026-04-15 09:00:00' },
    { type: 'out', amount: 3000, desc: 'شراء مساحات إعلانية', ref: null, refId: null, cat: 'مشتريات', date: '2026-02-10 10:00:00' },
    { type: 'out', amount: 1000, desc: 'تصوير وإنتاج فيديو', ref: null, refId: null, cat: 'مصاريف تشغيل', date: '2026-03-01 09:00:00' },
    { type: 'in', amount: 300, desc: 'إيراد استشارات تسويقية', ref: null, refId: null, cat: 'مبيعات', date: today + ' 11:00:00' },
    { type: 'out', amount: 200, desc: 'مصاريف إنترنت واتصالات', ref: null, refId: null, cat: 'مصاريف إدارية', date: today + ' 13:00:00' },
  ];
  for (const c of cashEntries) {
    await cashInsert.run('cash_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), c.type, c.amount, c.desc, c.ref, c.refId, c.cat, slug, slug, c.date);
  }

  // ── Invoices ──
  const invInsert = db.prepare(`INSERT INTO invoices (id, type, invoice_number, vendor_client_name, amount, description, invoice_date, created_by, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const invoices = isPrint ? [
    { type: 'sale', num: 'INV-P-001', party: 'شركة الأمل للتجارة', amount: 5000, desc: 'طباعة كتيب إعلاني', date: '2026-01-20' },
    { type: 'sale', num: 'INV-P-002', party: 'مؤسسة النور الخيرية', amount: 3000, desc: 'طباعة بروشورات', date: '2026-03-05' },
    { type: 'purchase', num: 'PO-P-001', party: 'مؤسسة الورق التجارية', amount: 1500, desc: 'ورق طباعة A4', date: '2026-01-18' },
  ] : [
    { type: 'sale', num: 'INV-A-001', party: 'مطعم كرم', amount: 15000, desc: 'حملة إعلانية متكاملة', date: '2026-02-05' },
    { type: 'sale', num: 'INV-A-002', party: 'شركة وادي التقنية', amount: 12000, desc: 'تصميم هوية بصرية', date: '2026-04-20' },
    { type: 'purchase', num: 'PO-A-001', party: 'شركة الإعلانات', amount: 3000, desc: 'مساحات إعلانية', date: '2026-02-10' },
  ];
  for (const i of invoices) {
    await invInsert.run('inv_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), i.type, i.num, i.party, i.amount, i.desc, i.date, slug, slug, i.date + ' 10:00:00');
  }

  // ── Attendance (last 10 days) ──
  const attInsert = db.prepare(`INSERT INTO attendance (id, user_id, date, clock_in, clock_out, status, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, 'present', ?, ?)`);
  for (let day = 9; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 5 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().slice(0, 10);
    for (const e of employees) {
      if (!e.user_id) continue;
      const clockIn = `${dateStr} 08:${String(10 + Math.floor(Math.random() * 30)).padStart(2, '0')}:00`;
      const clockOut = `${dateStr} 16:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}:00`;
      await attInsert.run('att_' + e.id + '_' + day, e.user_id, dateStr, clockIn, clockOut, slug, clockIn);
    }
  }

  // ── Leave Requests ──
  const leaveInsert = db.prepare(`INSERT INTO leave_requests (id, user_id, type, start_date, end_date, reason, status, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const leaves = isPrint ? [
    { uid: 'u_print_mgr', type: 'annual', start: '2026-06-01', end: '2026-06-10', reason: 'إجازة سنوية', status: 'approved' },
    { uid: 'u_emp1', type: 'sick', start: '2026-05-15', end: '2026-05-16', reason: 'مرض', status: 'approved' },
  ] : [
    { uid: 'u_adv_mgr', type: 'annual', start: '2026-07-01', end: '2026-07-15', reason: 'إجازة سنوية', status: 'approved' },
    { uid: 'u_emp2', type: 'personal', start: '2026-06-20', end: '2026-06-21', reason: 'ظرف شخصي', status: 'pending' },
  ];
  for (const l of leaves) {
    await leaveInsert.run('leave_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), l.uid, l.type, l.start, l.end, l.reason, l.status, slug, now);
  }

  // ── Salary Advances ──
  const advInsert = db.prepare(`INSERT INTO salary_advances (id, user_id, amount, reason, status, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const advances = isPrint ? [
    { uid: 'u_print_mgr', amount: 2000, reason: 'ظروف عائلية', status: 'approved' },
    { uid: 'u_emp1', amount: 1000, reason: 'شراء مستلزمات', status: 'pending' },
  ] : [
    { uid: 'u_adv_mgr', amount: 3000, reason: 'رحلة عمل', status: 'paid' },
  ];
  for (const a of advances) {
    await advInsert.run('adv_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), a.uid, a.amount, a.reason, a.status, slug, now);
  }

  // ── Payroll (last 3 months) ──
  const payInsert = db.prepare(`INSERT INTO payroll (id, user_id, month, year, base_salary, deductions, advances_deducted, late_penalties, net_salary, status, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`);
  const nowDate = new Date();
  for (let mOff = 2; mOff >= 0; mOff--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - mOff, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    for (const e of employees) {
      if (!e.user_id) continue;
      const deductions = mOff === 0 ? Math.round(e.salary * 0.07) : 0;
      const latePen = e.id === 'emp_print_03' && mOff === 1 ? 200 : 0;
      const advDeduct = e.id === 'emp_print_01' && mOff === 0 ? 1000 : 0;
      const bonus = e.id === 'emp_adv_02' && mOff === 0 ? 500 : 0;
      const net = e.salary - deductions - latePen - advDeduct + bonus;
      await payInsert.run('pay_seed_' + e.id + '_' + month + '_' + year, e.user_id, month, year, e.salary, deductions, advDeduct, latePen, net, slug, now);
    }
  }

  // ── Notifications ──
  const notifInsert = db.prepare(`INSERT INTO notifications (id, user_id, title, message, type, company_slug, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const notifs = [
    { uid: isPrint ? 'u_print_mgr' : 'u_adv_mgr', title: 'مرحباً بك في النظام', msg: 'تم إعداد بيانات تجريبية لاختبار التطبيق', type: 'info' },
    { uid: isPrint ? 'u_print_mgr' : 'u_adv_mgr', title: 'مشروع جديد', msg: 'تم إضافة مشاريع تجريبية للاختبار', type: 'success' },
  ];
  for (const n of notifs) {
    await notifInsert.run('notif_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), n.uid, n.title, n.msg, n.type, slug, now);
  }

  // ── Request types (if empty) ──
  const existingTypes = await db.prepare('SELECT COUNT(*) as c FROM request_types WHERE company_slug = ?').get(slug);
  if (existingTypes.c === 0) {
    const rtInsert = db.prepare(`INSERT INTO request_types (id, name, company_slug, created_at) VALUES (?, ?, ?, ?)`);
    for (const name of ['تصميم', 'طباعة', 'تغليف', 'توزيع', 'إعلان']) {
      await rtInsert.run('rt_seed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name, slug, now);
    }
  }

  const counts = {
    employees: empData.length,
    projects: isPrint ? 4 : 3,
    tasks: isPrint ? 7 : 7,
    cash_transactions: cashEntries.length,
    invoices: invoices.length,
    payroll: employees.filter(e => e.user_id).length * 3,
  };
  res.json({ message: 'Seed data created', company: slug, counts });
  } catch (err) { console.error('seed error:', err); res.status(500).json({ error: err.message }); }
});

export default router;
