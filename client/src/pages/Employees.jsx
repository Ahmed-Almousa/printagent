import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Plus, Users, Star, Clock, CheckCircle, Shield, Search, Edit2, Trash2, UserX, UserCheck, Eye, X, Phone, Mail, DollarSign, Briefcase, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const PRINTING_STAGES = [
  { key: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
  { key: 'design_review', labelAr: 'تصميم وتدقيق', labelEn: 'Design & Review' },
  { key: 'production', labelAr: 'إنتاج', labelEn: 'Production' },
  { key: 'finishing', labelAr: 'تشطيب', labelEn: 'Finishing' },
  { key: 'ready_pickup', labelAr: 'جاهز للاستلام', labelEn: 'Ready for Pickup' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered' },
];

const ADVERTISING_STAGES = [
  { key: 'brief', labelAr: 'موجز العميل', labelEn: 'Client Brief' },
  { key: 'concept_design', labelAr: 'مفهوم وتصميم', labelEn: 'Concept & Design' },
  { key: 'client_feedback', labelAr: 'ملاحظات العميل', labelEn: 'Client Feedback' },
  { key: 'launch', labelAr: 'إطلاق/نشر', labelEn: 'Launch/Publish' },
  { key: 'reporting', labelAr: 'تقارير', labelEn: 'Reporting' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered' },
];

const defaultForm = {
  full_name: '', email: '', phone: '', position: '', base_salary: '',
  username: '', password: '', role: 'employee', assigned_stages: ''
};

export default function Employees() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [viewEmp, setViewEmp] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const stageOptions = activeCompany === 'printing' ? PRINTING_STAGES : ADVERTISING_STAGES;
  const hasPerm = (perm) => {
    if (!user || !user.permissions) return false;
    if (user.role === 'super_admin') return true;
    return user.permissions.split(',').map(p => p.trim()).includes(perm);
  };
  const canEdit = hasPerm('employees.edit');
  const canDelete = hasPerm('employees.delete');

  const loadEmployees = () => {
    api.get(`/employees/${activeCompany}?all=1`).then(({ data }) => setEmployees(data)).catch(() => {});
    api.get(`/employees/${activeCompany}/performance`).then(({ data }) => setPerformance(data)).catch(() => {});
  };

  useEffect(() => { loadEmployees(); }, [activeCompany]);

  const filtered = employees.filter(e =>
    (e.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.phone || '').includes(searchTerm) ||
    (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${activeCompany}`, form);
      toast.success(t('تمت الإضافة', 'Added'));
      setShowForm(false);
      setForm({ ...defaultForm });
      loadEmployees();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || t('حدث خطأ', 'Error');
      toast.error(msg);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingEmp) return;
    try {
      await api.put(`/employees/${activeCompany}/${editingEmp.id}`, form);
      toast.success(t('تم التحديث', 'Updated'));
      setEditingEmp(null);
      setShowForm(false);
      setForm({ ...defaultForm });
      loadEmployees();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || t('حدث خطأ', 'Error');
      toast.error(msg);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/employees/${activeCompany}/${id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      setConfirmDelete(null);
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const handleToggleActive = async (emp) => {
    try {
      await api.put(`/employees/${activeCompany}/${emp.id}`, { is_active: emp.is_active ? 0 : 1 });
      toast.success(emp.is_active ? t('تم التعطيل', 'Disabled') : t('تم التفعيل', 'Enabled'));
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const openEdit = (emp) => {
    setEditingEmp(emp);
    setForm({
      full_name: emp.full_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      position: emp.position || '',
      base_salary: emp.base_salary || '',
      username: emp.username || '',
      password: '',
      role: emp.role || 'employee',
      assigned_stages: emp.assigned_stages || ''
    });
    setShowForm(true);
  };

  const handleStageToggle = (stageKey) => {
    const current = form.assigned_stages ? form.assigned_stages.split(',') : [];
    const next = current.includes(stageKey) ? current.filter(s => s !== stageKey) : [...current, stageKey];
    setForm({ ...form, assigned_stages: next.join(',') });
  };

  const getStageLabel = (key) => {
    const found = stageOptions.find(s => s.key === key);
    return found ? t(found.labelAr, found.labelEn) : key;
  };

  const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon size="20" className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('الموظفون', 'Employees')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة الموظفين وأدائهم', 'Manage employees & performance')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{t('بطاقات', 'Cards')}</button>
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{t('جدول', 'Table')}</button>
          </div>
          {canEdit && <button onClick={() => { setEditingEmp(null); setForm({...defaultForm}); setShowForm(true); }} className="btn-primary"><Plus size="18" /> {t('إضافة موظف', 'Add Employee')}</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('إجمالي الموظفين', 'Total Employees')} value={employees.length} icon={Users} color="bg-blue-500" />
        <StatCard label={t('النشطين', 'Active')} value={employees.filter(e => e.is_active !== 0 && e.user_active !== 0).length} icon={UserCheck} color="bg-green-500" />
        <StatCard label={t('غير النشطين', 'Inactive')} value={employees.filter(e => e.is_active === 0 || e.user_active === 0).length} icon={UserX} color="bg-red-500" />
        <StatCard label={t('بلا حساب', 'No Account')} value={employees.filter(e => !e.user_id).length} icon={Shield} color="bg-orange-500" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder={t('بحث بالاسم أو البريد أو الهاتف...', 'Search by name, email or phone...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-gray-500 hover:text-gray-700">
            {t('مسح', 'Clear')}
          </button>
        )}
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <div key={emp.id} className={`card card-hover relative ${(emp.is_active === 0 || emp.user_active === 0) ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                    {emp.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{emp.full_name}</h3>
                    <p className="text-xs text-gray-500">{emp.position || t('موظف', 'Employee')}</p>
                  </div>
                </div>
                {(emp.is_active === 0 || emp.user_active === 0) && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-medium">{t('غير نشط', 'Inactive')}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                {emp.email && <p className="flex items-center gap-1"><Mail size="12" /> {emp.email}</p>}
                {emp.phone && <p className="flex items-center gap-1"><Phone size="12" /> {emp.phone}</p>}
                {emp.username && <p className="flex items-center gap-1"><Shield size="12" /> @{emp.username}</p>}
                <p className="flex items-center gap-1"><DollarSign size="12" /> {emp.base_salary?.toLocaleString()}</p>
              </div>
              {emp.assigned_stages && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {emp.assigned_stages.split(',').map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-[10px]">{getStageLabel(s)}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-1 pt-2 border-t border-gray-100">
                <button onClick={() => setViewEmp(emp)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-all" title={t('عرض', 'View')}>
                  <Eye size="14" /> {t('عرض', 'View')}
                </button>
                {canEdit && <button onClick={() => openEdit(emp)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title={t('تعديل', 'Edit')}>
                  <Edit2 size="14" /> {t('تعديل', 'Edit')}
                </button>}
                {canEdit && <button onClick={() => handleToggleActive(emp)} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-all ${emp.is_active && emp.user_active !== 0 ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`} title={emp.is_active ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}>
                  {emp.is_active && emp.user_active !== 0 ? <UserX size="14" /> : <UserCheck size="14" />}
                  {emp.is_active && emp.user_active !== 0 ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
                </button>}
                {canDelete && <button onClick={() => setConfirmDelete(emp)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-all" title={t('حذف', 'Delete')}>
                  <Trash2 size="14" /> {t('حذف', 'Delete')}
                </button>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <Users size="48" className="mx-auto mb-3 opacity-30" />
              <p>{searchTerm ? t('لا توجد نتائج', 'No results found') : t('لا يوجد موظفون بعد', 'No employees yet')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الاسم', 'Name')}</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-600">{t('البريد', 'Email')}</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الهاتف', 'Phone')}</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الوظيفة', 'Position')}</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600">{t('الراتب', 'Salary')}</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600">{t('الحساب', 'Account')}</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-all ${(emp.is_active === 0 || emp.user_active === 0) ? 'text-gray-400' : ''}`}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {emp.full_name?.charAt(0)}
                        </div>
                        <span className="font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">{emp.email || '-'}</td>
                    <td className="py-3 px-3">{emp.phone || '-'}</td>
                    <td className="py-3 px-3">{emp.position || '-'}</td>
                    <td className="py-3 px-3 text-center">{emp.base_salary?.toLocaleString() || '0'}</td>
                    <td className="py-3 px-3 text-center">
                      {emp.username ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          <Shield size="10" /> {emp.role || 'employee'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{t('بدون', 'None')}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {emp.is_active !== 0 && emp.user_active !== 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600"><UserCheck size="12" /> {t('نشط', 'Active')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500"><UserX size="12" /> {t('غير نشط', 'Inactive')}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewEmp(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title={t('عرض', 'View')}><Eye size="15" /></button>
                        {canEdit && <button onClick={() => openEdit(emp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title={t('تعديل', 'Edit')}><Edit2 size="15" /></button>}
                        {canEdit && <button onClick={() => handleToggleActive(emp)} className={`p-1.5 rounded-lg ${emp.is_active && emp.user_active !== 0 ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`} title={emp.is_active ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}>
                          {emp.is_active && emp.user_active !== 0 ? <UserX size="15" /> : <UserCheck size="15" />}
                        </button>}
                        {canDelete && <button onClick={() => setConfirmDelete(emp)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title={t('حذف', 'Delete')}><Trash2 size="15" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-gray-400">
                      <p>{searchTerm ? t('لا توجد نتائج', 'No results found') : t('لا يوجد موظفون بعد', 'No employees yet')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Star size="18" className="text-yellow-500" /> {t('أداء الموظفين', 'Employee Performance')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الاسم', 'Name')}</th>
                <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الوظيفة', 'Position')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('المهام المنجزة', 'Completed')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('متوسط الوقت (س)', 'Avg Hours')}</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium">{p.full_name}</td>
                  <td className="py-3 px-3 text-gray-500">{p.position || '-'}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle size="14" /> {p.completedTasks}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-blue-600"><Clock size="14" /> {p.avgCompletionHours}</span>
                  </td>
                </tr>
              ))}
              {performance.length === 0 && (
                <tr><td colSpan="4" className="text-center py-8 text-gray-400">{t('لا توجد بيانات أداء', 'No performance data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditingEmp(null); setForm({...defaultForm}); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingEmp ? t('تعديل بيانات الموظف', 'Edit Employee') : t('إضافة موظف جديد', 'Add New Employee')}</h2>
              <button type="button" onClick={() => { setShowForm(false); setEditingEmp(null); setForm({...defaultForm}); }} className="text-gray-400 hover:text-gray-600"><X size="20" /></button>
            </div>
            <form onSubmit={editingEmp ? handleEdit : handleAdd} className="space-y-3">
              <div className="border-b pb-3 mb-1">
                <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1"><Shield size="14" /> {t('بيانات الحساب', 'Account Info')}</h3>
                {editingEmp?.user_id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3 text-xs text-blue-700 flex items-center gap-1">
                    <Shield size="12" /> {t('للموظف حساب دخول موجود. يمكنك تغيير كلمة المرور أو المعلومات أدناه.', 'Employee has an existing login account. You can change password or info below.')}
                  </div>
                )}
                {!editingEmp?.user_id && editingEmp && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-xs text-amber-700 flex items-center gap-1">
                    <Shield size="12" /> {t('ليس للموظف حساب دخول. أدخل البيانات لإنشاء حساب.', 'Employee has no login account. Fill in details to create one.')}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{t('اسم المستخدم', 'Username')} {(!editingEmp || !editingEmp.user_id) && <span className="text-red-500">*</span>}</label><input className="input" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} disabled={!!editingEmp?.user_id} required={!editingEmp || !editingEmp.user_id} /></div>
                  <div><label className="label">{t('كلمة المرور', 'Password')} {!editingEmp?.user_id && <span className="text-red-500">*</span>}{editingEmp?.user_id && <span className="text-xs text-gray-400 ms-1">({t('اتركه فارغاً', 'leave blank')})</span>}</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!editingEmp || !editingEmp.user_id} /></div>
                </div>
                <div className="mt-2">
                  <label className="label">{t('الدور', 'Role')}</label>
                  <select className="select" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                    <option value="employee">{t('موظف', 'Employee')}</option>
                    <option value="manager">{t('مدير', 'Manager')}</option>
                  </select>
                </div>
              </div>
              <div><label className="label">{t('الاسم الكامل', 'Full Name')}</label><input className="input" value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('البريد الإلكتروني', 'Email')} <span className="text-red-500">*</span></label><input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required /></div>
                <div><label className="label">{t('الهاتف', 'Phone')}</label><input className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('الوظيفة', 'Position')}</label><input className="input" value={form.position} onChange={(e) => setForm({...form, position: e.target.value})} /></div>
                <div><label className="label">{t('الراتب الأساسي', 'Base Salary')}</label><input type="number" className="input" value={form.base_salary} onChange={(e) => setForm({...form, base_salary: e.target.value})} /></div>
              </div>
              {form.role === 'employee' && (
                <div>
                  <label className="label">{t('المراحل المسؤول عنها', 'Assigned Stages')}</label>
                  <p className="text-xs text-gray-400 mb-2">{t('اختر المراحل التي سيعمل بها الموظف', 'Select stages this employee will work on')}</p>
                  <div className="flex flex-wrap gap-2">
                    {stageOptions.filter(s => s.key !== 'delivered').map(s => {
                      const selected = form.assigned_stages.split(',').includes(s.key);
                      return (
                        <button key={s.key} type="button" onClick={() => handleStageToggle(s.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selected ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                          {t(s.labelAr, s.labelEn)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingEmp ? t('تحديث', 'Update') : t('إضافة', 'Add')}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingEmp(null); setForm({...defaultForm}); }} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewEmp(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('تفاصيل الموظف', 'Employee Details')}</h2>
              <button type="button" onClick={() => setViewEmp(null)} className="text-gray-400 hover:text-gray-600"><X size="20" /></button>
            </div>
            <div className="flex items-center gap-4 mb-4 pb-4 border-b">
              <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
                {viewEmp.full_name?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{viewEmp.full_name}</h3>
                <p className="text-sm text-gray-500">{viewEmp.position || t('موظف', 'Employee')}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm"><Mail size="16" className="text-gray-400" /> <span>{viewEmp.email || '-'}</span></div>
              <div className="flex items-center gap-2 text-sm"><Phone size="16" className="text-gray-400" /> <span>{viewEmp.phone || '-'}</span></div>
              <div className="flex items-center gap-2 text-sm"><DollarSign size="16" className="text-gray-400" /> <span>{t('الراتب', 'Salary')}: {viewEmp.base_salary?.toLocaleString() || '0'}</span></div>
              <div className="flex items-center gap-2 text-sm"><Briefcase size="16" className="text-gray-400" /> <span>{t('الوظيفة', 'Position')}: {viewEmp.position || '-'}</span></div>
              <div className="flex items-center gap-2 text-sm"><Shield size="16" className="text-gray-400" /> <span>{t('الدور', 'Role')}: {viewEmp.role || t('موظف', 'Employee')}</span></div>
              <div className="flex items-center gap-2 text-sm">
                {viewEmp.is_active || viewEmp.user_active ? (
                  <span className="text-green-600 flex items-center gap-1"><UserCheck size="16" /> {t('نشط', 'Active')}</span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1"><UserX size="16" /> {t('غير نشط', 'Inactive')}</span>
                )}
              </div>
              {viewEmp.assigned_stages && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('المراحل المسؤول عنها', 'Assigned Stages')}</p>
                  <div className="flex flex-wrap gap-1">
                    {viewEmp.assigned_stages.split(',').map(s => (
                      <span key={s} className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs">{getStageLabel(s)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size="24" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">{t('تأكيد الحذف', 'Confirm Delete')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t(`سيتم حذف ${confirmDelete.full_name} نهائياً وجميع بياناته`, `${confirmDelete.full_name} and all their data will be permanently deleted`)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">{t('حذف', 'Delete')}</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">{t('إلغاء', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
