import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getAccessiblePages } from '../../utils/permissions';
import {
  LayoutDashboard, FolderKanban, ListTodo, Users, Clock,
  CalendarCheck, HandCoins, DollarSign, Settings, Archive, Shield,
  ChevronRight, ChevronLeft, X, Wallet, ClipboardList, Receipt
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'لوحة التحكم', labelEn: 'Dashboard', page: 'dashboard' },
  { path: '/cash', icon: Receipt, label: 'الحركة اليومية', labelEn: 'Cash Movement', page: 'cash' },
  { path: '/projects-tasks', icon: FolderKanban, label: 'المشاريع والمهام', labelEn: 'Projects & Tasks', page: 'projects' },
  { path: '/employees', icon: Users, label: 'الموظفون', labelEn: 'Employees', page: 'employees' },
  { path: '/attendance', icon: Clock, label: 'الحضور', labelEn: 'Attendance', page: 'attendance' },
  { path: '/requests', icon: ClipboardList, label: 'الطلبات', labelEn: 'Requests', page: 'requests' },
  { path: '/finances', icon: Wallet, label: 'المالية', labelEn: 'Finances', page: 'finances' },
  { path: '/permissions', icon: Shield, label: 'الصلاحيات', labelEn: 'Permissions', page: 'permissions' },
  { path: '/settings', icon: Settings, label: 'الإعدادات', labelEn: 'Settings', page: 'settings' },
  { path: '/archive', icon: Archive, label: 'الأرشيف', labelEn: 'Archive', page: 'archive' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { lang } = useCompany();
  const { user } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const accessiblePages = getAccessiblePages(user);
  const visibleItems = menuItems.filter(item => accessiblePages.includes(item.page));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}
      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50
        bg-white border-l border-gray-200
        transition-all duration-300 ease-in-out
        flex flex-col
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-primary-700">{t('نظام الإدارة', 'ERP System')}</h1>
              <p className="text-xs text-gray-500">{t('مطبعة ووكالة إعلانية', 'Print & Ad Agency')}</p>
            </div>
          )}
          {collapsed && <div className="w-full text-center"><div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center mx-auto font-bold text-sm">E</div></div>}
          <button onClick={onToggle} className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
          <button onClick={onMobileClose} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{t(item.label, item.labelEn)}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          {!collapsed && (
            <p className="text-xs text-gray-400 text-center">
              {t('الإصدار 1.0', 'Version 1.0')}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
