import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Permissions() {
  const { activeCompany, lang } = useCompany();
  const { user: currentUser } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const [users, setUsers] = useState([]);
  const [permTree, setPermTree] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState([]);

  useEffect(() => {
    api.get(`/permissions/tree`).then(({ data }) => setPermTree(data)).catch(() => {});
    loadUsers();
  }, [activeCompany]);

  const loadUsers = () => {
    api.get(`/permissions/${activeCompany}/users`).then(({ data }) => setUsers(data)).catch(() => {});
  };

  const selectUser = (u) => {
    setSelectedUser(u);
    setUserPerms(u.permissionsList || []);
  };

  const togglePerm = (key) => {
    setUserPerms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const toggleModule = (moduleKey, permKeys) => {
    const allModulePerms = permKeys.map(p => `${moduleKey}.${p.key}`);
    const allActive = allModulePerms.every(p => userPerms.includes(p));
    if (allActive) {
      setUserPerms(prev => prev.filter(p => !allModulePerms.includes(p)));
    } else {
      setUserPerms(prev => {
        const next = [...prev];
        allModulePerms.forEach(p => { if (!next.includes(p)) next.push(p); });
        return next;
      });
    }
  };

  const save = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/permissions/${activeCompany}/users/${selectedUser.id}`, { permissions: userPerms });
      toast.success(t('تم الحفظ', 'Saved'));
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const moduleActiveCount = (moduleKey, permDefs) => {
    const count = permDefs.filter(p => userPerms.includes(`${moduleKey}.${p.key}`)).length;
    return `${count}/${permDefs.length}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('الصلاحيات', 'Permissions')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('إدارة صلاحيات المستخدمين', 'Manage user permissions')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="font-bold text-gray-700 mb-3">{t('المستخدمون', 'Users')}</h2>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className={`w-full text-right p-3 rounded-lg text-sm transition-colors ${
                  selectedUser?.id === u.id
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                }`}
              >
                <div className="font-medium">{u.full_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {u.username} {u.email && `| ${u.email}`}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{u.role}</span>
                  {!u.is_active && <span className="text-xs text-red-500">{t('غير نشط', 'Inactive')}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card">
          {!selectedUser ? (
            <div className="text-center py-12 text-gray-400">
              {t('اختر مستخدماً لإدارة صلاحياته', 'Select a user to manage permissions')}
            </div>
          ) : selectedUser.role === 'super_admin' ? (
            <div className="text-center py-12 text-amber-600 bg-amber-50 rounded-lg">
              {t('المشرف الرئيسي لديه جميع الصلاحيات ولا يمكن تعديلها', 'Super admin has all permissions and cannot be modified')}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-700 text-lg">{selectedUser.full_name}</h2>
                  <p className="text-sm text-gray-500">{selectedUser.email || t('لا يوجد إيميل', 'No email')}</p>
                </div>
                <button onClick={save} className="btn-primary">{t('حفظ الصلاحيات', 'Save Permissions')}</button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {permTree.map(module => {
                  const permKeys = module.permissions.map(p => `${module.key}.${p.key}`);
                  const allSelected = permKeys.every(p => userPerms.includes(p));
                  return (
                    <div key={module.key} className={`border rounded-lg overflow-hidden ${
                      allSelected ? 'border-green-200' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleModule(module.key, module.permissions)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${
                          allSelected ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'
                        } hover:bg-gray-100 transition-colors`}
                      >
                        <span>{t(module.name_ar, module.name_en)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          allSelected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {moduleActiveCount(module.key, module.permissions)}
                        </span>
                      </button>
                      <div className="px-4 py-2 flex flex-wrap gap-2">
                        {module.permissions.map(perm => {
                          const fullKey = `${module.key}.${perm.key}`;
                          const active = userPerms.includes(fullKey);
                          return (
                            <button
                              key={fullKey}
                              onClick={() => togglePerm(fullKey)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                active
                                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {t(perm.name_ar, perm.name_en)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}