import { Router } from 'express';
import { getMasterDb, getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

const PERMISSIONS_TREE = [
  { key: 'dashboard', name_ar: 'لوحة التحكم', name_en: 'Dashboard', icon: 'LayoutDashboard', permissions: [{ key: 'view', name_ar: 'عرض', name_en: 'View' }] },
  { key: 'projects', name_ar: 'المشاريع', name_en: 'Projects', icon: 'FolderKanban', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }, { key: 'create', name_ar: 'إنشاء', name_en: 'Create' },
    { key: 'edit', name_ar: 'تعديل', name_en: 'Edit' }, { key: 'delete', name_ar: 'حذف', name_en: 'Delete' },
    { key: 'archive', name_ar: 'أرشفة', name_en: 'Archive' }
  ]},
  { key: 'tasks', name_ar: 'المهام', name_en: 'Tasks', icon: 'ListTodo', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }, { key: 'create', name_ar: 'إنشاء', name_en: 'Create' },
    { key: 'edit', name_ar: 'تعديل', name_en: 'Edit' }, { key: 'delete', name_ar: 'حذف', name_en: 'Delete' },
    { key: 'assign', name_ar: 'تعيين', name_en: 'Assign' }, { key: 'approve', name_ar: 'موافقة', name_en: 'Approve' },
    { key: 'outsource', name_ar: 'الاستعانة بمصادر خارجية', name_en: 'Outsource' }
  ]},
  { key: 'employees', name_ar: 'الموظفون', name_en: 'Employees', icon: 'Users', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }, { key: 'create', name_ar: 'إنشاء', name_en: 'Create' },
    { key: 'edit', name_ar: 'تعديل', name_en: 'Edit' }, { key: 'delete', name_ar: 'حذف', name_en: 'Delete' }
  ]},
  { key: 'attendance', name_ar: 'الحضور', name_en: 'Attendance', icon: 'Clock', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }, { key: 'clock', name_ar: 'تسجيل حضور', name_en: 'Clock In/Out' },
    { key: 'manage', name_ar: 'إدارة', name_en: 'Manage' }
  ]},
  { key: 'leave', name_ar: 'الإجازات', name_en: 'Leave', icon: 'CalendarCheck', permissions: [
    { key: 'view_own', name_ar: 'عرض إجازاتي', name_en: 'View Own' },
    { key: 'view_all', name_ar: 'عرض الكل', name_en: 'View All' },
    { key: 'request', name_ar: 'تقديم طلب', name_en: 'Request' }, { key: 'approve', name_ar: 'اعتماد', name_en: 'Approve' }
  ]},
  { key: 'advances', name_ar: 'السلف', name_en: 'Advances', icon: 'HandCoins', permissions: [
    { key: 'view_own', name_ar: 'عرض سلفي', name_en: 'View Own' },
    { key: 'view_all', name_ar: 'عرض الكل', name_en: 'View All' },
    { key: 'request', name_ar: 'تقديم طلب', name_en: 'Request' }, { key: 'approve', name_ar: 'اعتماد', name_en: 'Approve' }
  ]},
  { key: 'payroll', name_ar: 'الرواتب', name_en: 'Payroll', icon: 'DollarSign', permissions: [
    { key: 'view_own', name_ar: 'عرض راتبي', name_en: 'View Own' },
    { key: 'view_all', name_ar: 'عرض الكل', name_en: 'View All' },
    { key: 'calculate', name_ar: 'احتساب', name_en: 'Calculate' }, { key: 'pay', name_ar: 'صرف', name_en: 'Pay' }
  ]},
  { key: 'settings', name_ar: 'الإعدادات', name_en: 'Settings', icon: 'Settings', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }, { key: 'manage', name_ar: 'إدارة', name_en: 'Manage' }
  ]},
  { key: 'notifications', name_ar: 'الإشعارات', name_en: 'Notifications', icon: 'Bell', permissions: [
    { key: 'view', name_ar: 'مشاهدة', name_en: 'View' }
  ]},
  { key: 'chat', name_ar: 'المحادثة', name_en: 'Chat', icon: 'MessageSquare', permissions: [
    { key: 'view', name_ar: 'مشاهدة', name_en: 'View' }, { key: 'send', name_ar: 'إرسال', name_en: 'Send' }
  ]},
  { key: 'archive', name_ar: 'الأرشيف', name_en: 'Archive', icon: 'Archive', permissions: [
    { key: 'view', name_ar: 'عرض', name_en: 'View' }
  ]},
];

router.get('/tree', authenticate, (req, res) => {
  res.json(PERMISSIONS_TREE);
});

router.get('/:companySlug/users', authenticate, companyAccess, async (req, res) => {
  try {
    const masterDb = getMasterDb();
    const { companySlug } = req.params;
    const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const users = await masterDb.prepare(
      'SELECT id, username, full_name, email, role, permissions, is_active FROM users WHERE company_id = ? OR role = ? ORDER BY role, full_name'
    ).all(company.id, 'super_admin');

    const db = getCompanyDb(companySlug);
    const employees = await db.prepare('SELECT user_id, full_name as emp_name, position FROM employees').all();
    const empMap = {};
    employees.forEach(e => { empMap[e.user_id] = e; });

    const result = users.map(u => ({
      ...u,
      position: empMap[u.id]?.position || null,
      permissionsList: u.permissions ? u.permissions.split(',').filter(Boolean) : []
    }));

    res.json(result);
  } catch (err) { console.error('permissions.js error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/users/:userId', authenticate, companyAccess, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can assign permissions' });
    }
    const masterDb = getMasterDb();
    const { userId } = req.params;
    const { permissions } = req.body;

    const targetUser = await masterDb.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify super admin permissions' });
    }

    const permStr = Array.isArray(permissions) ? permissions.join(',') : '';
    await masterDb.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permStr, userId);
    res.json({ success: true, permissions: permStr });
  } catch (err) { console.error('permissions.js error:', err); res.status(500).json({ error: err.message }); }
});

export default router;