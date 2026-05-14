import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Plus, MoreHorizontal, User, Clock, AlertCircle, ExternalLink, ChevronDown, FolderKanban, PlusCircle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';

const PRINTING_STAGES = [
  { key: 'draft', labelAr: 'مسودة', labelEn: 'Draft', color: 'border-t-gray-400' },
  { key: 'design_review', labelAr: 'تصميم وتدقيق', labelEn: 'Design & Review', color: 'border-t-blue-400' },
  { key: 'pending_approval', labelAr: 'موافقة المدير', labelEn: 'Manager Approval', color: 'border-t-yellow-400' },
  { key: 'production', labelAr: 'إنتاج', labelEn: 'Production', color: 'border-t-purple-400', requireApproval: true },
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

const EXECUTION_LABELS = { internal: 'داخلي', external: 'خارجي', shared: 'مشترك' };

export default function Tasks() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [requestTypes, setRequestTypes] = useState([]);
  const [form, setForm] = useState({ project_id: '', title: '', description: '', assignee_id: '', priority: 'medium', due_date: '', stage: '' });
  const [projForm, setProjForm] = useState({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });

  const t = (ar, en) => lang === 'ar' ? ar : en;
  const allStages = activeCompany === 'printing' ? PRINTING_STAGES : ADVERTISING_STAGES;
  const assignedStages = user?.assigned_stages ? user.assigned_stages.split(',') : null;
  const stages = assignedStages ? allStages.filter(s => assignedStages.includes(s.key)) : allStages;
  const isPrinting = activeCompany === 'printing';

  const loadProjects = () => {
    api.get(`/projects/${activeCompany}?in_tasks=1`).then(({ data }) => setProjects(data)).catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    api.get(`/users/${activeCompany}`).then(({ data }) => setUsers(data)).catch(() => {});
    api.get(`/settings/${activeCompany}/request-types`).then(({ data }) => setRequestTypes(data)).catch(() => {});
  }, [activeCompany]);

  useEffect(() => {
    const params = selectedProject ? `?project_id=${selectedProject}` : '';
    api.get(`/tasks/${activeCompany}${params}`).then(({ data }) => setTasks(data)).catch(() => {});
  }, [activeCompany, selectedProject]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${activeCompany}`, projForm);
      toast.success(t('تمت إضافة المشروع', 'Project added'));
      setShowProjectForm(false);
      setProjForm({ title: '', description: '', client_name: '', order_value: '', down_payment: '', request_date: '', request_type_id: '', execution_method: 'internal' });
      loadProjects();
    } catch (err) {
      toast.error(t('حدث خطأ', 'Error'));
    }
  };

  const groupedTasks = {};
  stages.forEach(s => {
    const stageTasks = tasks.filter(t => t.stage === s.key);
    const stageProjects = projects.filter(p => p.stage === s.key).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      stage: p.stage,
      is_project: true,
      project_id: p.id,
      assignee_name: null,
      priority: 'medium',
      due_date: null,
      client_name: p.client_name,
      order_value: p.order_value,
      down_payment: p.down_payment,
      request_type_name: p.request_type_name,
      execution_method: p.execution_method,
    }));
    groupedTasks[s.key] = [...stageProjects, ...stageTasks];
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tasks/${activeCompany}`, form);
      toast.success(t('تمت إضافة المهمة', 'Task added'));
      setShowForm(false);
      setForm({ project_id: '', title: '', description: '', assignee_id: '', priority: 'medium', due_date: '', stage: '' });
      const params = selectedProject ? `?project_id=${selectedProject}` : '';
      const { data } = await api.get(`/tasks/${activeCompany}${params}`);
      setTasks(data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const moveItem = async (item, newStage) => {
    try {
      if (item.is_project) {
        await api.put(`/projects/${activeCompany}/${item.id}`, { stage: newStage });
      } else {
        if (isPrinting && newStage === 'production' && item.stage !== 'production') {
          if (user.role === 'employee') {
            toast.error(t('فقط المدير يمكنه الموافقة على الإنتاج', 'Only managers can approve production'));
            return;
          }
        }
        await api.put(`/tasks/${activeCompany}/${item.id}`, { stage: newStage });
      }
      loadProjects();
      const params = selectedProject ? `?project_id=${selectedProject}` : '';
      const { data } = await api.get(`/tasks/${activeCompany}${params}`);
      setTasks(data);
      if (!item.is_project && isPrinting && newStage === 'production') {
        toast.success(t('تمت الموافقة ونقل المهمة', 'Approved & moved to production'));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const priorityColor = (p) => {
    const map = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
    return map[p] || map.medium;
  };

  const executionLabel = (method) => t(EXECUTION_LABELS[method] || method, method);
  const executionColor = (method) => {
    const map = { internal: 'bg-blue-100 text-blue-700', external: 'bg-orange-100 text-orange-700', shared: 'bg-purple-100 text-purple-700' };
    return map[method] || 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('لوحة المهام', 'Task Board')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة المشاريع والمهام', 'Manage projects & tasks')}</p>
        </div>
        <div className="flex gap-2">
          <select className="select w-44" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="">{t('كل المشاريع', 'All Projects')}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button onClick={() => { setForm({ ...form, project_id: selectedProject }); setShowForm(true); }} className="btn-primary">
            <Plus size={18} /> {t('مهمة جديدة', 'New Task')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`card p-3 cursor-pointer transition-all duration-200 hover:shadow-md border-2 ${selectedProject === project.id ? 'border-primary-400 bg-primary-50/30' : 'border-transparent'}`}
            onClick={() => setSelectedProject(selectedProject === project.id ? '' : project.id)}
          >
            <div className="flex items-center gap-2 mb-1">
              <FolderKanban size="14" className="text-primary-600 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-gray-800 truncate">{project.title}</h3>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {project.request_type_name && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">{project.request_type_name}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${executionColor(project.execution_method)}`}>{executionLabel(project.execution_method)}</span>
            </div>
            {(project.order_value > 0 || project.down_payment > 0) && (
              <div className="flex gap-2 text-[10px] text-gray-500 mt-1">
                {project.order_value > 0 && <span>{t('قيمة', 'Val')}: {project.order_value?.toLocaleString()}</span>}
                {project.down_payment > 0 && <span className="text-green-600">{t('دفعة', 'Paid')}: {project.down_payment?.toLocaleString()}</span>}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={() => { setProjForm({ ...projForm, request_date: new Date().toISOString().split('T')[0] }); setShowProjectForm(true); }}
          className="card p-3 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50/30 flex items-center justify-center gap-2 text-gray-400 hover:text-primary-600 transition-all"
        >
          <PlusCircle size="18" />
          <span className="text-sm">{t('مشروع جديد', 'New Project')}</span>
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {stages.map((stage) => (
          <div key={stage.key} className={`kanban-column border-t-4 ${stage.color}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-gray-700">{t(stage.labelAr, stage.labelEn)}</h3>
              <span className="badge bg-gray-200 text-gray-600">{groupedTasks[stage.key]?.length || 0}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {(groupedTasks[stage.key] || []).map((item) => (
                <div
                  key={item.id}
                  className={`kanban-card group cursor-pointer ${item.is_project ? 'border-r-2 border-r-primary-400 bg-primary-50/20' : ''}`}
                  onClick={() => item.is_project ? navigate(`/projects`) : navigate(`/tasks/${activeCompany}/${item.id}`)}
                >
                  {item.is_project ? (
                    <>
                      <div className="flex items-center gap-1 mb-1">
                        <FolderKanban size="12" className="text-primary-600" />
                        <span className="text-[10px] font-semibold text-primary-600">{t('مشروع', 'Project')}</span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-800 mb-1">{item.title}</h4>
                      {item.client_name && <p className="text-[11px] text-gray-500 mb-1">{item.client_name}</p>}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {item.request_type_name && <span className="text-[10px] px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded">{item.request_type_name}</span>}
                        {item.execution_method && <span className={`text-[10px] px-1 py-0.5 rounded ${executionColor(item.execution_method)}`}>{executionLabel(item.execution_method)}</span>}
                      </div>
                      {(item.order_value > 0 || item.down_payment > 0) && (
                        <div className="flex gap-2 text-[10px] text-gray-500">
                          {item.order_value > 0 && <span>{t('قيمة', 'Val')}: {item.order_value?.toLocaleString()}</span>}
                          {item.down_payment > 0 && <span className="text-green-600">{t('دفعة', 'Paid')}: {item.down_payment?.toLocaleString()}</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <span className={`badge text-[10px] ${priorityColor(item.priority)}`}>{item.priority}</span>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button className="p-0.5 rounded hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal size="14" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-sm font-medium text-gray-800 mb-2">{item.title}</h4>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          {item.assignee_name && (
                            <span className="flex items-center gap-1"><User size="12" /> {item.assignee_name}</span>
                          )}
                          {item.is_outsourced === 1 && (
                            <span className="text-orange-500 font-medium">{t('مستأجر', 'Out')}</span>
                          )}
                        </div>
                        <span className="flex items-center gap-1"><Clock size="12" /> {item.due_date || '-'}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-1 pt-1">
                {(groupedTasks[stage.key] || []).map(item => {
                  const nextIdx = stages.indexOf(stage) + 1;
                  const isLastStage = stage.key === 'delivered';
                  const isCancelledOrArchived = stage.key === 'cancelled' || stage.key === 'archived';
                  if (isCancelledOrArchived) return null;
                  return (
                    <div key={item.id} className="flex gap-1 w-full">
                      {nextIdx < stages.length && !isLastStage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveItem(item, stages[nextIdx].key); }}
                          className="flex-1 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                        >
                          {t('نقل', 'Move')} →
                        </button>
                      )}
                      {isLastStage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveItem(item, 'archived'); }}
                          className="flex-1 py-1 text-[10px] bg-orange-100 hover:bg-orange-200 rounded text-orange-600 transition-colors"
                        >
                          <Archive size="10" className="inline" /> {t('أرشفة', 'Archive')}
                        </button>
                      )}
                      {!isLastStage && !isCancelledOrArchived && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveItem(item, 'cancelled'); }}
                          className="py-1 px-2 text-[10px] bg-red-50 hover:bg-red-100 rounded text-red-500 transition-colors"
                          title={t('إلغاء', 'Cancel')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showProjectForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowProjectForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-semibold mb-4">{t('مشروع جديد', 'New Project')}</h2>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div><label className="label">{t('العنوان', 'Title')}</label><input className="input" value={projForm.title} onChange={(e) => setProjForm({...projForm, title: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={projForm.description} onChange={(e) => setProjForm({...projForm, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('العميل', 'Client')}</label><input className="input" value={projForm.client_name} onChange={(e) => setProjForm({...projForm, client_name: e.target.value})} /></div>
                <div>
                  <label className="label">{t('تاريخ الطلب', 'Request Date')}</label>
                  <input type="date" className="input" value={projForm.request_date} onChange={(e) => setProjForm({...projForm, request_date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('نوع الطلب', 'Request Type')}</label>
                  <select className="select" value={projForm.request_type_id} onChange={(e) => setProjForm({...projForm, request_type_id: e.target.value})}>
                    <option value="">{t('اختر النوع', 'Select type')}</option>
                    {requestTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('طريقة التنفيذ', 'Execution')}</label>
                  <select className="select" value={projForm.execution_method} onChange={(e) => setProjForm({...projForm, execution_method: e.target.value})}>
                    <option value="internal">{t('داخلي', 'Internal')}</option>
                    <option value="external">{t('خارجي', 'External')}</option>
                    <option value="shared">{t('مشترك', 'Shared')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('قيمة الطلب', 'Order Value')}</label>
                  <input type="number" className="input" value={projForm.order_value} onChange={(e) => setProjForm({...projForm, order_value: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="label">{t('دفعة على الحساب', 'Down Payment')}</label>
                  <input type="number" className="input" value={projForm.down_payment} onChange={(e) => setProjForm({...projForm, down_payment: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => setShowProjectForm(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('مهمة جديدة', 'New Task')}</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">{t('المشروع', 'Project')}</label>
                <select className="select" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})} required>
                  <option value="">{t('اختر مشروعاً', 'Select project')}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div><label className="label">{t('العنوان', 'Title')}</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('المسؤول', 'Assignee')}</label>
                  <select className="select" value={form.assignee_id} onChange={(e) => setForm({...form, assignee_id: e.target.value})}>
                    <option value="">{t('اختر', 'Select')}</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('الأولوية', 'Priority')}</label>
                  <select className="select" value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})}>
                    <option value="low">{t('منخفضة', 'Low')}</option>
                    <option value="medium">{t('متوسطة', 'Medium')}</option>
                    <option value="high">{t('عالية', 'High')}</option>
                    <option value="urgent">{t('عاجلة', 'Urgent')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('تاريخ التسليم', 'Due Date')}</label>
                <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
