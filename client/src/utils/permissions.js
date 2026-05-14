function hasPermission(user, perm) {
  if (!user || !user.permissions) return false;
  const perms = user.permissions.split(',').map(p => p.trim());
  return perms.includes(perm);
}

function hasAnyPermission(user, permList) {
  return permList.some(p => hasPermission(user, p));
}

const PAGE_PERMISSION_MAP = {
  '': 'dashboard.view',
  dashboard: 'dashboard.view',
  projects: 'projects.view',
  tasks: 'tasks.view',
  employees: 'employees.view',
  attendance: 'attendance.view',
  requests: 'requests', // checked via custom fn
  finances: 'finances', // checked via custom fn
  settings: 'settings.view',
  archive: 'archive.view',
  permissions: 'settings.manage',
};

export function canAccessPage(user, page) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const perm = PAGE_PERMISSION_MAP[page];
  if (!perm) return false;

  // Requests page: leave OR advances access
  if (page === 'requests') {
    return hasAnyPermission(user, ['leave.view_own', 'leave.view_all', 'leave.request',
      'advances.view_own', 'advances.view_all', 'advances.request']);
  }

  // Finances page: payroll OR invoices OR reports access
  if (page === 'finances') {
    return hasAnyPermission(user, [
      'payroll.view_own', 'payroll.view_all', 'payroll.calculate', 'payroll.pay',
      'finances.payroll_view_own', 'finances.payroll_view_all', 'finances.payroll_manage',
      'finances.invoices_view', 'finances.invoices_create', 'finances.invoices_delete',
      'finances.reports_view']);
  }

  return hasPermission(user, perm);
}

export function getAccessiblePages(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return Object.keys(PAGE_PERMISSION_MAP).filter(Boolean);
  if (!user.permissions) return [];
  const allPages = Object.keys(PAGE_PERMISSION_MAP).filter(Boolean);
  return allPages.filter(page => canAccessPage(user, page));
}
