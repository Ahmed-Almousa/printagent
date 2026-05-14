import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { SwitchCamera, LogOut, Globe, Menu, Bell, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { activeCompany, setActiveCompany, lang, switchLang, theme, toggleTheme } = useCompany();
  const [companies, setCompanies] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const t = (ar, en) => lang === 'ar' ? ar : en;

  useEffect(() => {
    api.get('/auth/companies').then(({ data }) => setCompanies(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user && activeCompany) {
      api.get(`/notifications/${activeCompany}`).then(({ data }) => setNotifs(data.filter(n => !n.is_read))).catch(() => {});
    }
  }, [user, activeCompany]);

  const handleSwitchCompany = async (slug) => {
    setActiveCompany(slug);
    setShowCompany(false);
    toast.success(t('تم التبديل', 'Switched'));
  };

  const unreadCount = notifs.length;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <Menu size={20} />
        </button>

        {user?.role === 'super_admin' && (
          <div className="relative">
            <button
              onClick={() => setShowCompany(!showCompany)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-700 text-white text-sm font-medium hover:from-primary-600 hover:to-primary-800 transition-all"
            >
              <SwitchCamera size={16} />
              <span>{activeCompany === 'printing' ? t('المطبعة', 'Printing') : t('الوكالة الإعلانية', 'Agency')}</span>
            </button>
            {showCompany && (
              <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-50">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSwitchCompany(c.slug)}
                    className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${activeCompany === c.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${c.type === 'printing' ? 'bg-blue-500' : 'bg-green-500'}`} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title={theme === 'dark' ? t('واجهة فاتحة', 'Light mode') : t('واجهة داكنة', 'Dark mode')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={() => switchLang(lang === 'ar' ? 'en' : 'ar')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title={t('English', 'العربية')}
        >
          <Globe size={18} />
          <span className="text-xs mr-1">{lang === 'ar' ? 'EN' : 'AR'}</span>
        </button>

        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[280px] max-h-80 overflow-y-auto z-50">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t('الإشعارات', 'Notifications')}</span>
                {unreadCount > 0 && (
                  <button onClick={async () => { await api.put(`/notifications/${activeCompany}/read-all`); setNotifs([]); }} className="text-xs text-primary-600 hover:underline">{t('قراءة الكل', 'Read all')}</button>
                )}
              </div>
              {notifs.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">{t('لا توجد إشعارات', 'No notifications')}</p>}
              {notifs.map((n) => (
                <div key={n.id} className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <p className="text-sm font-medium text-gray-700">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mr-3 pr-3 border-r border-gray-200">
          <div className="text-left">
            <p className="text-sm font-medium text-gray-700">{user?.full_name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
            {user?.full_name?.charAt(0)}
          </div>
          <button onClick={logout} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title={t('تسجيل خروج', 'Logout')}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
