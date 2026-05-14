import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import io from 'socket.io-client';
import { ArrowRight, Send, Paperclip, User, Calendar, Clock, Download, MessageSquare, Archive, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PRINTING_STAGES = [
  { key: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
  { key: 'design_review', labelAr: 'تصميم وتدقيق', labelEn: 'Design & Review' },
  { key: 'pending_approval', labelAr: 'موافقة المدير', labelEn: 'Manager Approval' },
  { key: 'production', labelAr: 'إنتاج', labelEn: 'Production' },
  { key: 'finishing', labelAr: 'تشطيب', labelEn: 'Finishing' },
  { key: 'ready_pickup', labelAr: 'جاهز للاستلام', labelEn: 'Ready for Pickup' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered' },
  { key: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
  { key: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived' },
];

const ADVERTISING_STAGES = [
  { key: 'brief', labelAr: 'موجز العميل', labelEn: 'Client Brief' },
  { key: 'concept_design', labelAr: 'مفهوم وتصميم', labelEn: 'Concept & Design' },
  { key: 'client_feedback', labelAr: 'ملاحظات العميل', labelEn: 'Client Feedback' },
  { key: 'launch', labelAr: 'إطلاق/نشر', labelEn: 'Launch/Publish' },
  { key: 'reporting', labelAr: 'تقارير', labelEn: 'Reporting' },
  { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered' },
  { key: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
  { key: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived' },
];

export default function TaskDetail() {
  const { companySlug, taskId } = useParams();
  const navigate = useNavigate();
  const { lang } = useCompany();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const chatEnd = useRef(null);
  const stagesRef = useRef(null);

  const t = (ar, en) => lang === 'ar' ? ar : en;
  const allStages = companySlug === 'printing' ? PRINTING_STAGES : ADVERTISING_STAGES;
  const assignedStages = user?.assigned_stages ? user.assigned_stages.split(',') : null;
  const stages = allStages;

  useEffect(() => {
    const s = io();
    setSocket(s);
    s.emit('join-task', taskId);
    s.on('new-message', (data) => {
      setComments(prev => [...prev, data]);
    });
    return () => { s.emit('leave-task', taskId); s.disconnect(); };
  }, [taskId]);

  useEffect(() => {
    api.get(`/tasks/${companySlug}/${taskId}`).then(({ data }) => {
      setTask(data);
      setComments(data.comments || []);
      setAttachments(data.attachments || []);
    }).catch(() => navigate('/tasks'));
    api.get(`/users/${companySlug}`).then(({ data }) => setUsers(data)).catch(() => {});
  }, [companySlug, taskId]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      const { data } = await api.post(`/tasks/${companySlug}/${taskId}/comment`, { message });
      setComments(prev => [...prev, data]);
      if (socket) {
        socket.emit('task-message', { taskId, ...data });
      }
      setMessage('');
    } catch (err) {
      toast.error(t('فشل الإرسال', 'Failed to send'));
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    try {
      const { data } = await api.post(`/tasks/${companySlug}/${taskId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachments(prev => [...prev, ...data]);
      toast.success(t('تم الرفع', 'Uploaded'));
    } catch (err) {
      toast.error(t('فشل الرفع', 'Upload failed'));
    }
  };

  const handleStageChange = async (newStage) => {
    try {
      const { data } = await api.put(`/tasks/${companySlug}/${taskId}`, { stage: newStage });
      setTask(prev => ({ ...prev, ...data }));
      toast.success(t('تم التحديث', 'Updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل', 'Failed'));
    }
  };

  const handleOutsourceToggle = async () => {
    try {
      const newVal = task.is_outsourced ? 0 : 1;
      await api.put(`/tasks/${companySlug}/${taskId}`, { is_outsourced: newVal });
      setTask(prev => ({ ...prev, is_outsourced: newVal }));
      toast.success(newVal ? t('تم وضعها كمستأجَرة', 'Marked as outsourced') : t('تم إزالة علم الاستئجار', 'Removed outsourced'));
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const handleArchive = async () => {
    if (!archiveReason.trim()) return;
    try {
      await api.put(`/projects/${companySlug}/${task.project_id}`, {
        is_archived: 1, archive_reason: archiveReason, status: 'archived'
      });
      if (task.stage !== 'delivered') {
        await api.put(`/tasks/${companySlug}/${taskId}`, { stage: 'archived' });
      }
      toast.success(t('تم نقل المشروع للأرشيف', 'Project archived'));
      setShowArchiveModal(false);
      navigate('/archive');
    } catch (err) {
      toast.error(t('فشل الأرشفة', 'Archive failed'));
    }
  };

  if (!task) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bg-primary-600"></div></div>;

  const currentIdx = stages.findIndex(s => s.key === task.stage);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button onClick={() => navigate('/tasks')} className="btn-ghost text-sm">
        <ArrowRight size="16" /> {t('العودة للمهام', 'Back to Tasks')}
      </button>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{task.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{task.description || t('لا يوجد وصف', 'No description')}</p>
          </div>
          <div className="flex items-center gap-2">
            {task.stage !== 'archived' && task.stage !== 'cancelled' && (
              <>
                {task.stage === 'delivered' ? (
                  <button onClick={() => { setArchiveReason(''); setShowArchiveModal(true); }} className="btn-ghost text-sm text-orange-600 hover:text-orange-700">
                    <Archive size="16" /> {t('أرشفة', 'Archive')}
                  </button>
                ) : (
                  <button onClick={() => handleStageChange('cancelled')} className="btn-ghost text-sm text-red-500 hover:text-red-600">
                    ✕ {t('إلغاء', 'Cancel')}
                  </button>
                )}
              </>
            )}
            <span className={`badge ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{task.priority}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
          <div>
            <p className="text-xs text-gray-500">{t('المرحلة', 'Stage')}</p>
            <p className="text-sm font-medium">{stages.find(s => s.key === task.stage)?.[lang === 'ar' ? 'labelAr' : 'labelEn'] || task.stage}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('المسؤول', 'Assignee')}</p>
            <p className="text-sm font-medium flex items-center gap-1"><User size="14" /> {task.assignee_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('تاريخ التسليم', 'Due Date')}</p>
            <p className="text-sm font-medium flex items-center gap-1"><Calendar size="14" /> {task.due_date || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('مستأجَر', 'Outsourced')}</p>
            <p className="text-sm font-medium">
              <button onClick={handleOutsourceToggle} className={`px-2 py-0.5 rounded text-xs ${task.is_outsourced ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                {task.is_outsourced ? t('نعم', 'Yes') : t('لا', 'No')}
              </button>
            </p>
          </div>
        </div>

          <div ref={stagesRef} className="overflow-x-auto pb-2" style={{ scrollBehavior: 'smooth' }}>
            <div className="flex gap-1 min-w-max">
              {stages.map((s, i) => {
                const isActive = task.stage === s.key;
                const isPast = currentIdx >= 0 && i < currentIdx;
                const canAdvance = user.role === 'super_admin' || user.role === 'manager' || (assignedStages && assignedStages.includes(task.stage));
                const isTerminal = s.key === 'archived' || s.key === 'cancelled';
                const isClickable = !isTerminal && canAdvance && currentIdx >= 0 && (i === currentIdx + 1 || s.key === 'cancelled');
                return (
                  <button
                    key={s.key}
                    onClick={() => isClickable && handleStageChange(s.key)}
                    disabled={!isClickable}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                      ${isActive ? (s.key === 'cancelled' ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300' : 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-300') : ''}
                      ${isPast ? 'bg-green-100 text-green-700' : ''}
                      ${!isActive && !isPast && isClickable ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : ''}
                      ${!isClickable && !isActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${s.key === 'delivered' ? 'border-2 border-dashed border-green-400' : ''}
                      ${s.key === 'archived' && !isActive ? 'bg-orange-50 text-orange-600' : ''}
                      ${s.key === 'cancelled' && !isActive ? 'bg-red-50 text-red-600' : ''}
                    `}
                  >
                    {s.key === 'delivered' && <CheckCircle size="12" />}
                    {s.key === 'archived' && <Archive size="12" />}
                    {s.key === 'cancelled' && <span className="text-xs">✕</span>}
                    <span>{t(s.labelAr, s.labelEn)}</span>
                    {isPast && <CheckCircle size="10" className="opacity-60" />}
                    {i < stages.length - 1 && !isActive && (
                      <span className="text-gray-300 mx-0.5">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquare size="18" /> {t('المحادثة', 'Chat')}
          </h2>
          <div className="h-64 overflow-y-auto mb-3 space-y-3" style={{ maxHeight: '300px' }}>
            {comments.map((c, i) => (
              <div key={c.id || i} className={`flex ${c.user_id === user?.id ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  c.user_id === user?.id ? 'bg-primary-50 text-gray-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-xs text-gray-500 mb-1">{c.user_name || 'User'}</p>
                  <p>{c.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              className="input flex-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('اكتب رسالة...', 'Type a message...')}
            />
            <button type="submit" className="btn-primary px-3"><Send size="16" /></button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Paperclip size="18" /> {t('المرفقات', 'Attachments')}
          </h2>
          <div className="mb-4">
            <label className="btn-secondary cursor-pointer w-full justify-center">
              <Paperclip size="16" /> {t('رفع ملفات', 'Upload Files')}
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('لا توجد مرفقات', 'No attachments')}</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/${att.file_path.replace(/\\/g, '/')}`}
                  target="_blank"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Download size="16" className="text-gray-400" />
                  <span className="text-gray-700 flex-1 truncate">{att.file_name}</span>
                  <span className="text-xs text-gray-400">{new Date(att.created_at).toLocaleDateString()}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowArchiveModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Archive size="18" className="text-orange-600" />
              {t('نقل للأرشيف', 'Move to Archive')}
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              {t('سيتم نقل المشروع بالكامل إلى الأرشيف مع الاحتفاظ بجميع المحادثات والملفات.', 'The entire project will be archived with all chats and files preserved.')}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleArchive(); }} className="space-y-3">
              <div>
                <label className="label">{t('سبب الأرشفة', 'Archive Reason')}</label>
                <textarea className="input" rows="3" value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder={t('مثال: تم تسليم الطلب للعميل', 'e.g. Delivered to client')} required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 bg-orange-600 hover:bg-orange-700">
                  {t('أرشفة', 'Archive')}
                </button>
                <button type="button" onClick={() => setShowArchiveModal(false)} className="btn-secondary">
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
