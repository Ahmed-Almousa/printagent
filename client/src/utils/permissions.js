function hasPermission(user, perm) {
  if (!user || !user.permissions) return false;
  const perms = user.permissions.split(',').map(p => p.trim());
  return perms.includes(perm);
}

function hasAnyPermission(user, permList) {
  return permList.some(p => hasPermission(user, p));
}

function hasModulePermission(user, moduleKey) {
  if (!user || !user.permissions) return false;
  const perms = user.permissions.split(',').map(p => p.trim());
  return perms.some(p => p.startsWith(moduleKey + '.'));
}

export function canAccessPage(user, page) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  // Dashboard: always visible to all roles with dashboard.view
  if (page === 'dashboard') return hasPermission(user, 'dashboard.view');

  // Projects & Tasks: show if user has ANY projects.* OR tasks.* permission
  if (page === 'projects') return hasModulePermission(user, 'projects') || hasModulePermission(user, 'tasks');
  if (page === 'tasks') return hasModulePermission(user, 'tasks');

  // Attendance: show if user has ANY attendance.* permission (view, clock, manage)
  if (page === 'attendance') return hasModulePermission(user, 'attendance');

  // Employees: only if employees.view
  if (page === 'employees') return hasPermission(user, 'employees.view');

  // Requests: leave OR advances access
  if (page === 'requests') {
    return hasAnyPermission(user, ['leave.view_own', 'leave.view_all', 'leave.request',
      'advances.view_own', 'advances.view_all', 'advances.request']);
  }

  // Finances: payroll OR invoices OR reports access
  if (page === 'finances') {
    return hasAnyPermission(user, [
      'payroll.view_own', 'payroll.view_all', 'payroll.calculate', 'payroll.pay',
      'finances.payroll_view_own', 'finances.payroll_view_all', 'finances.payroll_manage',
      'finances.invoices_view', 'finances.invoices_create', 'finances.invoices_delete',
      'finances.reports_view']);
  }

  // Settings, Archive: only if view permission
  if (page === 'settings') return hasPermission(user, 'settings.view');
  if (page === 'archive') return hasPermission(user, 'archive.view');
  if (page === 'permissions') return hasPermission(user, 'settings.manage');

  return false;
}

const ALL_PAGES = ['dashboard', 'projects', 'tasks', 'employees', 'attendance', 'requests', 'finances', 'settings', 'archive', 'permissions'];

export function getAccessiblePages(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return [...ALL_PAGES];
  if (!user.permissions) return [];
  return ALL_PAGES.filter(page => canAccessPage(user, page));
}
