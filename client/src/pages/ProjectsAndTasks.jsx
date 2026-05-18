import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Plus, Search, Edit3, Trash2, FolderKanban, Calendar, Tag, GitBranch,
  DollarSign, CreditCard, Send, MoreHorizontal, User, Clock, PlusCircle, Archive,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const EXECUTION_METHODS = [
  { value: 'internal', labelAr: 'داخلي', labelEn: 'Internal' },
  { value: 'external', labelAr: 'خارجي', labelEn: 'External' },
  { value: 'shared', labelAr: 'مشترك', labelEn: 'Shared' },
];

const PRINTING_STAGES = [
  { key: 'draft', labelAr: 'مسودة', labelEn: 'Draft', color: 'border-t-gray-400' },
  { key: 'design_review', labelAr: 'تصميم وتدقيق', labelEn: 'Design & Review', color: 'border-t-blue-400' },
  { key: 'production', labelAr: 'إنتاج', labelEn: 'Production', color: 'border-t-purple-400' },
  { key: 'finishing', labelAr: 'تشطيب', labelEn: 'Finishing', color: 'border-t-orange-400' },
  { key: 'ready_pickup', labelAr: 'جاهز للاستلام', labelEn: 'Ready for Pickup', color: 'border-t-green-400' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered', color: 'border-t-green-600' },
  { key: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', color: 'border-t-red-500' },
  { key: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived', color: 'border-t-orange-500' },
];

const ADVERTISING_STAGES = [
  { key: 'brief', labelAr: 'موجز العميل', labelEn: 'Client Brief', color: 'border-t-gray-400' },
  { key: 'concept_design', labelAr: 'مفهوم وتصميم', labelEn: 'Concept & Design', color: 'border-t-blue-400' },
  { key: 'client_feedback', labelAr: 'ملاحظات العميل', labelEn: 'Client Feedback', color: 'border-t-yellow-400' },
  { key: 'launch', labelAr: 'إطلاق/نشر', labelEn: 'Launch/Publish', color: 'border-t-purple-400' },
  { key: 'reporting', labelAr: 'تقارير', labelEn: 'Reporting', color: 'border-t-green-400' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered', color: 'border-t-green-600' },
  { key: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', color: 'border-t-red-500' },
  { key: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived', color: 'border-t-orange-500' },
];

export default function ProjectsAndTasks() {
  const navigate = useNavigate();
  const { activeCompany, lang } = useCompany();
  const { user, hasPermission } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const allStages = activeCompany === 'printing' ? PRINTING_STAGES : ADVERTISING_STAGES;
  const isPrinting = activeCompany === 'printing';
  const assignedStages = user?.assigned_stages ? user.assigned_stages.split(',') : null;
  const stages = assignedStages ? allStages.filter(s => assignedStages.includes(s.key)) : allStages;

  const [projects, setProjects] = useState([]);
  const [projectsInTasks, setProjectsInTasks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  const [showProjModal, setShowProjModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [projForm, setProjForm] = useState({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ project_id: '', title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });

  const loadAll = useCallback(() => {
    api.get(`/projects/${activeCompany}?in_tasks=0`).then(({ data }) => setProjects(data)).catch(() => {});
    api.get(`/projects/${activeCompany}?in_tasks=1`).then(({ data }) => setProjectsInTasks(data)).catch(() => {});
    const params = selectedProject ? `?project_id=${selectedProject}` : '';
    api.get(`/tasks/${activeCompany}${params}`).then(({ data }) => setTasks(data)).catch(() => {});
    api.get(`/users/${activeCompany}`).then(({ data }) => setUsers(data)).catch(() => {});
    api.get(`/settings/${activeCompany}/request-types`).then(({ data }) => setRequestTypes(data)).catch(() => {});
  }, [activeCompany, selectedProject]);

  useEffect(() => { loadAll(); }, [activeCompany, selectedProject, loadAll]);

  const handleProjSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/projects/${activeCompany}/${editing.id}`, projForm);
        toast.success(t('تم التحديث', 'Updated'));
      } else {
        await api.post(`/projects/${activeCompany}`, projForm);
        toast.success(t('تمت الإضافة', 'Added'));
      }
      setShowProjModal(false);
      setEditing(null);
      setProjForm({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });
      loadAll();
    } catch (err) { toast.error(t('حدث خطأ', 'Error')); }
  };

  const handleDeleteProj = async (id) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try { await api.delete(`/projects/${activeCompany}/${id}`); toast.success(t('تم الحذف', 'Deleted')); loadAll(); }
    catch (err) { toast.error(t('حدث خطأ', 'Error')); }
  };

  const handleApprove = async (id) => {
    try {
      const firstStage = isPrinting ? 'draft' : 'brief';
      await api.put(`/projects/approve/${activeCompany}/${id}`);
      toast.success(t('تمت الموافقة ونقل المشروع للمهام', 'Approved & moved to tasks'));
      loadAll();
    } catch (err) { toast.error(t('حدث خطأ', 'Error')); }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/projects/reject/${activeCompany}/${id}`);
      toast.success(t('تم رفض المشروع ونقله للأرشيف', 'Rejected & archived'));
      loadAll();
    } catch (err) { toast.error(t('حدث خطأ', 'Error')); }
  };

  const handleSendToTasks = async (id) => {
    try { await api.put(`/projects/send-to-tasks/${activeCompany}/${id}`); toast.success(t('تم الإرسال للمهام', 'Sent to tasks')); loadAll(); }
    catch (err) { toast.error(t('حدث خطأ', 'Error')); }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tasks/${activeCompany}`, taskForm);
      toast.success(t('تمت إضافة المهمة', 'Task added'));
      setShowTaskModal(false);
      setTaskForm({ project_id: '', title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || t('حدث خطأ', 'Error')); }
  };

  const moveItem = async (item, newStage) => {
    try {
      if (item.is_project) {
        await api.put(`/projects/${activeCompany}/${item.id}`, { stage: newStage });
      } else {
        if (isPrinting && newStage === 'production' && item.stage !== 'production' && user.role === 'employee') {
          toast.error(t('فقط المدير يمكنه الموافقة على الإنتاج', 'Only managers can approve production'));
          return;
        }
        await api.put(`/tasks/${activeCompany}/${item.id}`, { stage: newStage });
      }
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || t('حدث خطأ', 'Error')); }
  };

  const openEdit = (project) => {
    setEditing(project);
    setProjForm({
      title: project.title, description: project.description || '', client_name: project.client_name || '',
      order_value: project.order_value?.toString() || '', down_payment: project.down_payment?.toString() || '',
      request_date: project.request_date || '', request_type_id: project.request_type_id || '',
      execution_method: project.execution_method || 'internal',
    });
    setShowProjModal(true);
  };

  const filteredProjs = projects.filter(p => p.title.includes(search) || (p.client_name || '').includes(search));

  const groupedTasks = {};
  stages.forEach(s => {
    const stageTasks = tasks.filter(t => t.stage === s.key);
    const stageProjects = projectsInTasks.filter(p => p.stage === s.key).map(p => ({
      id: p.id, title: p.title, description: p.description, stage: p.stage, is_project: true,
      project_id: p.id, assignee_name: null, priority: 'medium', due_date: null,
      client_name: p.client_name, order_value: p.order_value, down_payment: p.down_payment,
      request_type_name: p.request_type_name, execution_method: p.execution_method,
    }));
    groupedTasks[s.key] = [...stageProjects, ...stageTasks];
  });

  const priorityColor = (p) => {
    const map = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
    return map[p] || map.medium;
  };

  const executionLabel = (method) => {
    const m = EXECUTION_METHODS.find(e => e.value === method);
    return m ? t(m.labelAr, m.labelEn) : method;
  };
  const executionColor = (method) => {
    const map = { internal: 'bg-blue-100 text-blue-700', external: 'bg-orange-100 text-orange-700', shared: 'bg-purple-100 text-purple-700' };
    return map[method] || 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{t('المشاريع والمهام', 'Projects & Tasks')}</h1>
      </div>

      {/* ───── PROJECTS SECTION ───── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('المشاريع', 'Projects')}</h2>
          {hasPermission('projects.create') && (
            <button onClick={() => { setEditing(null); setProjForm({ ...projForm, request_date: new Date().toISOString().split('T')[0] }); setShowProjModal(true); }} className="btn-primary text-sm py-1.5">
              <Plus size="16" /> {t('مشروع جديد', 'New Project')}
            </button>
          )}
        </div>
        <div className="relative mb-4">
          <Search size="16" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pr-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...')} />
        </div>
        {filteredProjs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('لا توجد مشاريع', 'No projects')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProjs.map(p => (
              <div key={p.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <FolderKanban size="16" className="text-primary-600 mt-0.5" />
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {hasPermission('projects.edit') && (
                      <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600" title={t('تعديل', 'Edit')}><Edit3 size="13" /></button>
                    )}
                    {hasPermission('projects.delete') && (
                      <button onClick={() => handleDeleteProj(p.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title={t('حذف', 'Delete')}><Trash2 size="13" /></button>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{p.title}</h3>
                {p.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {p.client_name && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{p.client_name}</span>}
                  {p.request_type_name && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">{p.request_type_name}</span>}
                  <span className={`px-1.5 py-0.5 rounded ${executionColor(p.execution_method)}`}>{executionLabel(p.execution_method)}</span>
                </div>
                {(p.order_value > 0 || p.down_payment > 0) && (
                  <div className="flex gap-2 text-[10px] text-gray-500 mt-2 pt-2 border-t">
                    {p.order_value > 0 && <span><DollarSign size="10" className="inline" /> {p.order_value?.toLocaleString()}</span>}
                    {p.down_payment > 0 && <span className="text-green-600"><CreditCard size="10" className="inline" /> {p.down_payment?.toLocaleString()}</span>}
                  </div>
                )}
                {(user?.role === 'manager' || user?.role === 'super_admin') && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button onClick={() => handleApprove(p.id)} className="flex-1 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded-lg flex items-center justify-center gap-1 transition-colors">
                      <CheckCircle size="13" /> {t('موافقة', 'Approve')}
                    </button>
                    <button onClick={() => handleReject(p.id)} className="flex-1 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-lg flex items-center justify-center gap-1 transition-colors">
                      <XCircle size="13" /> {t('رفض', 'Reject')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───── TASKS KANBAN SECTION ───── */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-800">{t('لوحة المهام', 'Task Board')}</h2>
        <div className="flex gap-2">
          <select className="select w-40 text-sm" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="">{t('كل المشاريع', 'All Projects')}</option>
            {(() => {
              const allProjs = [...projects, ...projectsInTasks];
              const seen = new Set();
              return allProjs.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
            })().map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          {hasPermission('tasks.create') && (
            <button onClick={() => { setTaskForm({ ...taskForm, project_id: selectedProject }); setShowTaskModal(true); }} className="btn-primary text-sm py-1.5">
              <Plus size="16" /> {t('مهمة', 'Task')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '50vh' }}>
        {stages.map((stage) => {
          const items = groupedTasks[stage.key] || [];
          return (
            <div key={stage.key} className={`kanban-column border-t-4 ${stage.color} flex-shrink-0`} style={{ width: '260px' }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-gray-700">{t(stage.labelAr, stage.labelEn)}</h3>
                <span className="badge bg-gray-200 text-gray-600">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {items.map(item => (
                  <div key={item.id} className={`kanban-card group cursor-pointer ${item.is_project ? 'border-r-2 border-r-primary-400 bg-primary-50/20' : ''}`}
                    onClick={() => item.is_project ? null : navigate(`/tasks/${activeCompany}/${item.id}`)}>
                    {item.is_project ? (
                      <>
                        <div className="flex items-center gap-1 mb-1">
                          <FolderKanban size="11" className="text-primary-600" />
                          <span className="text-[10px] font-semibold text-primary-600">{t('مشروع', 'Project')}</span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-800 mb-1">{item.title}</h4>
                        {item.client_name && <p className="text-[11px] text-gray-500">{item.client_name}</p>}
                        {item.request_type_name && <span className="text-[10px] px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded inline-block mt-1">{item.request_type_name}</span>}
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <span className={`badge text-[10px] ${priorityColor(item.priority)}`}>{item.priority}</span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-800 mb-2">{item.title}</h4>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{item.assignee_name && <><User size="11" className="inline" /> {item.assignee_name}</>}</span>
                          <span>{item.due_date || '-'}</span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-1 mt-2 pt-1 border-t border-gray-100">
                      {(() => {
                        const nextIdx = stages.indexOf(stage) + 1;
                        if (stage.key === 'cancelled' || stage.key === 'archived') return null;
                        return (
                          <>
                            {stage.key === 'delivered' ? (
                              <button onClick={(e) => { e.stopPropagation(); moveItem(item, 'archived'); }} className="flex-1 py-1 text-[10px] bg-orange-100 hover:bg-orange-200 rounded text-orange-600"><Archive size="10" className="inline" /> {t('أرشفة', 'Archive')}</button>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); moveItem(item, stages[nextIdx].key); }} className="flex-1 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-500">{t('نقل', 'Move')} →</button>
                            )}
                            {stage.key !== 'delivered' && (
                              <button onClick={(e) => { e.stopPropagation(); moveItem(item, 'cancelled'); }} className="py-1 px-2 text-[10px] bg-red-50 hover:bg-red-100 rounded text-red-500">✕</button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Modal */}
      {showProjModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowProjModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-semibold mb-4">{editing ? t('تعديل مشروع', 'Edit Project') : t('مشروع جديد', 'New Project')}</h2>
            <form onSubmit={handleProjSubmit} className="space-y-3">
              <div><label className="label">{t('العنوان', 'Title')}</label><input className="input" value={projForm.title} onChange={(e) => setProjForm({...projForm, title: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={projForm.description} onChange={(e) => setProjForm({...projForm, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('العميل', 'Client')}</label><input className="input" value={projForm.client_name} onChange={(e) => setProjForm({...projForm, client_name: e.target.value})} /></div>
                <div><label className="label"><Calendar size="14" className="inline ml-1" />{t('تاريخ الطلب', 'Request Date')}</label><input type="date" className="input" value={projForm.request_date} onChange={(e) => setProjForm({...projForm, request_date: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label"><Tag size="14" className="inline ml-1" />{t('نوع الطلب', 'Request Type')}</label>
                  <select className="select" value={projForm.request_type_id} onChange={(e) => setProjForm({...projForm, request_type_id: e.target.value})}>
                    <option value="">{t('اختر النوع', 'Select type')}</option>
                    {requestTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div><label className="label"><GitBranch size="14" className="inline ml-1" />{t('طريقة التنفيذ', 'Execution')}</label>
                  <select className="select" value={projForm.execution_method} onChange={(e) => setProjForm({...projForm, execution_method: e.target.value})}>
                    {EXECUTION_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.labelAr, m.labelEn)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label"><DollarSign size="14" className="inline ml-1" />{t('قيمة الطلب', 'Order Value')}</label><input type="number" className="input" value={projForm.order_value} onChange={(e) => setProjForm({...projForm, order_value: e.target.value})} placeholder="0" /></div>
                <div><label className="label"><CreditCard size="14" className="inline ml-1" />{t('دفعة على الحساب', 'Down Payment')}</label><input type="number" className="input" value={projForm.down_payment} onChange={(e) => setProjForm({...projForm, down_payment: e.target.value})} placeholder="0" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? t('تحديث', 'Update') : t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => setShowProjModal(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('مهمة جديدة', 'New Task')}</h2>
            <form onSubmit={handleTaskSubmit} className="space-y-3">
              <div><label className="label">{t('المشروع', 'Project')}</label>
                <select className="select" value={taskForm.project_id} onChange={(e) => setTaskForm({...taskForm, project_id: e.target.value})} required>
                  <option value="">{t('اختر مشروعاً', 'Select project')}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div><label className="label">{t('العنوان', 'Title')}</label><input className="input" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('المسؤول', 'Assignee')}</label>
                  <select className="select" value={taskForm.assignee_id} onChange={(e) => setTaskForm({...taskForm, assignee_id: e.target.value})}>
                    <option value="">{t('اختر', 'Select')}</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div><label className="label">{t('الأولوية', 'Priority')}</label>
                  <select className="select" value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}>
                    <option value="low">{t('منخفضة', 'Low')}</option>
                    <option value="medium">{t('متوسطة', 'Medium')}</option>
                    <option value="high">{t('عالية', 'High')}</option>
                    <option value="urgent">{t('عاجلة', 'Urgent')}</option>
                  </select>
                </div>
              </div>
              <div><label className="label">{t('تاريخ التسليم', 'Due Date')}</label><input type="date" className="input" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => setShowTaskModal(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}