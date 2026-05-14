import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import api from '../utils/api';
import { Plus, Search, Edit3, Trash2, FolderKanban, Calendar, Tag, GitBranch, DollarSign, CreditCard, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const EXECUTION_METHODS = [
  { value: 'internal', labelAr: 'داخلي', labelEn: 'Internal' },
  { value: 'external', labelAr: 'خارجي', labelEn: 'External' },
  { value: 'shared', labelAr: 'مشترك', labelEn: 'Shared' },
];

export default function Projects() {
  const navigate = useNavigate();
  const { activeCompany, lang } = useCompany();
  const [projects, setProjects] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const loadProjects = () => {
    api.get(`/projects/${activeCompany}?in_tasks=0`).then(({ data }) => setProjects(data)).catch(() => {});
  };

  const loadRequestTypes = () => {
    api.get(`/settings/${activeCompany}/request-types`).then(({ data }) => setRequestTypes(data)).catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    loadRequestTypes();
  }, [activeCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/projects/${activeCompany}/${editing.id}`, form);
        toast.success(t('تم التحديث', 'Updated'));
      } else {
        await api.post(`/projects/${activeCompany}`, form);
        toast.success(t('تمت الإضافة', 'Added'));
      }
      setShowModal(false);
      setEditing(null);
      setForm({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });
      loadProjects();
    } catch (err) {
      toast.error(t('حدث خطأ', 'Error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try {
      await api.delete(`/projects/${activeCompany}/${id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      loadProjects();
    } catch (err) {
      toast.error(t('حدث خطأ', 'Error'));
    }
  };

  const handleSendToTasks = async (id) => {
    try {
      await api.put(`/projects/send-to-tasks/${activeCompany}/${id}`);
      toast.success(t('تم الإرسال للمهام', 'Sent to tasks'));
      loadProjects();
    } catch (err) {
      toast.error(t('حدث خطأ', 'Error'));
    }
  };

  const openEdit = (project) => {
    setEditing(project);
    setForm({
      title: project.title,
      description: project.description || '',
      client_name: project.client_name || '',
      order_value: project.order_value?.toString() || '',
      down_payment: project.down_payment?.toString() || '',
      request_date: project.request_date || '',
      request_type_id: project.request_type_id || '',
      execution_method: project.execution_method || 'internal',
    });
    setShowModal(true);
  };

  const executionLabel = (method) => {
    const m = EXECUTION_METHODS.find(e => e.value === method);
    return m ? t(m.labelAr, m.labelEn) : method;
  };

  const executionColor = (method) => {
    const map = { internal: 'bg-blue-100 text-blue-700', external: 'bg-orange-100 text-orange-700', shared: 'bg-purple-100 text-purple-700' };
    return map[method] || 'bg-gray-100 text-gray-500';
  };

  const filtered = projects.filter(p => p.title.includes(search) || (p.client_name || '').includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('المشاريع', 'Projects')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة مشاريع وطلبات', 'Manage projects & orders')}</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: new Date().toISOString().split('T')[0], request_type_id: '', execution_method: 'internal' }); setShowModal(true); }} className="btn-primary">
          <Plus size={18} /> {t('مشروع جديد', 'New Project')}
        </button>
      </div>

      <div className="relative">
        <Search size="18" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <div key={project.id} className="card card-hover group cursor-pointer" onClick={() => navigate(`/tasks`)}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <FolderKanban size="20" />
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleSendToTasks(project.id)} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title={t('إرسال للمهام', 'Send to tasks')}><Send size="14" /></button>
                <button onClick={() => openEdit(project)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Edit3 size="14" /></button>
                <button onClick={() => handleDelete(project.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size="14" /></button>
              </div>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{project.title}</h3>
            {project.description && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{project.description}</p>}
            <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
              {project.client_name && <span className="px-2 py-0.5 bg-gray-100 rounded">{project.client_name}</span>}
              {project.request_type_name && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">{project.request_type_name}</span>}
              <span className={`px-2 py-0.5 rounded ${executionColor(project.execution_method)}`}>{executionLabel(project.execution_method)}</span>
              <span className={`px-2 py-0.5 rounded ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{project.status}</span>
            </div>
            {(project.order_value > 0 || project.down_payment > 0) && (
              <div className="pt-2 border-t border-gray-100 flex gap-3 text-xs">
                {project.order_value > 0 && <span className="text-gray-500">{t('قيمة الطلب', 'Order Value')}: <strong>{project.order_value?.toLocaleString()}</strong></span>}
                {project.down_payment > 0 && <span className="text-green-600">{t('دفعة على الحساب', 'Down Payment')}: <strong>{project.down_payment?.toLocaleString()}</strong></span>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <FolderKanban size="48" className="mx-auto mb-3 opacity-30" />
            <p>{t('لا توجد مشاريع بعد', 'No projects yet')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-semibold mb-4">{editing ? t('تعديل مشروع', 'Edit Project') : t('مشروع جديد', 'New Project')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="label">{t('العنوان', 'Title')}</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('العميل', 'Client')}</label><input className="input" value={form.client_name} onChange={(e) => setForm({...form, client_name: e.target.value})} /></div>
                <div>
                  <label className="label"><Calendar size="14" className="inline ml-1" />{t('تاريخ الطلب', 'Request Date')}</label>
                  <input type="date" className="input" value={form.request_date} onChange={(e) => setForm({...form, request_date: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label"><Tag size="14" className="inline ml-1" />{t('نوع الطلب', 'Request Type')}</label>
                  <select className="select" value={form.request_type_id} onChange={(e) => setForm({...form, request_type_id: e.target.value})}>
                    <option value="">{t('اختر النوع', 'Select type')}</option>
                    {requestTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label"><GitBranch size="14" className="inline ml-1" />{t('طريقة التنفيذ', 'Execution')}</label>
                  <select className="select" value={form.execution_method} onChange={(e) => setForm({...form, execution_method: e.target.value})}>
                    {EXECUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.labelAr, m.labelEn)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label"><DollarSign size="14" className="inline ml-1" />{t('قيمة الطلب', 'Order Value')}</label>
                  <input type="number" className="input" value={form.order_value} onChange={(e) => setForm({...form, order_value: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="label"><CreditCard size="14" className="inline ml-1" />{t('دفعة على الحساب', 'Down Payment')}</label>
                  <input type="number" className="input" value={form.down_payment} onChange={(e) => setForm({...form, down_payment: e.target.value})} placeholder="0" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? t('تحديث', 'Update') : t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
