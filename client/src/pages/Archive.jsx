import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import api from '../utils/api';
import { Archive, ChevronDown, ChevronUp, MessageSquare, Paperclip, Calendar, User, Download, XCircle, CheckCircle } from 'lucide-react';

const STAGE_LABELS = {
  delivered: { ar: 'تم التسليم', en: 'Delivered', color: 'bg-green-100 text-green-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-red-100 text-red-700' },
  archived: { ar: 'مؤرشف', en: 'Archived', color: 'bg-orange-100 text-orange-700' },
};

export default function ArchivePage() {
  const { activeCompany, lang } = useCompany();
  const [projects, setProjects] = useState([]);
  const [expandedProject, setExpandedProject] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const t = (ar, en) => lang === 'ar' ? ar : en;

  useEffect(() => {
    api.get(`/archive/${activeCompany}`).then(({ data }) => setProjects(data)).catch(() => {});
  }, [activeCompany]);

  const stageInfo = (stage) => STAGE_LABELS[stage] || { ar: stage, en: stage, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Archive size="24" className="text-orange-600" />
        <h1 className="text-xl font-bold text-gray-800">{t('الأرشيف', 'Archive')}</h1>
        <span className="text-sm text-gray-400">({projects.length})</span>
      </div>

      <div className="flex gap-2 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1"><CheckCircle size="12" className="text-green-600" /> {t('تم التسليم', 'Delivered')}</span>
        <span className="flex items-center gap-1"><XCircle size="12" className="text-red-600" /> {t('ملغي', 'Cancelled')}</span>
        <span className="flex items-center gap-1"><Archive size="12" className="text-orange-600" /> {t('مؤرشف', 'Archived')}</span>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center py-12">
          <Archive size="48" className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{t('لا توجد مشاريع في الأرشيف', 'No projects in archive')}</p>
        </div>
      ) : (
        projects.map(proj => {
          const stage = stageInfo(proj.stage);
          return (
            <div key={proj.id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedProject(expandedProject === proj.id ? null : proj.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-gray-800">{proj.title}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${stage.color}`}>{t(stage.ar, stage.en)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{proj.description || t('لا يوجد وصف', 'No description')}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    {proj.client_name && <span>{t('العميل', 'Client')}: {proj.client_name}</span>}
                    {proj.archive_reason && <span className="text-orange-600">{t('السبب', 'Reason')}: {proj.archive_reason}</span>}
                    {proj.stage === 'cancelled' && <span className="text-red-600">{t('ملغي', 'Cancelled')}</span>}
                    <span><Calendar size="12" className="inline" /> {new Date(proj.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{proj.tasks?.length || 0} {t('مهمة', 'tasks')}</span>
                  {expandedProject === proj.id ? <ChevronUp size="18" /> : <ChevronDown size="18" />}
                </div>
              </div>

              {expandedProject === proj.id && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  {(!proj.tasks || proj.tasks.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-4">{t('لا توجد مهام', 'No tasks')}</p>
                  ) : (
                    proj.tasks.map(task => (
                      <div key={task.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">{task.title}</span>
                            <span className="badge text-xs">{task.stage}</span>
                            {task.assignee_name && (
                              <span className="text-xs text-gray-400 flex items-center gap-1"><User size="12" />{task.assignee_name}</span>
                            )}
                          </div>
                          {expandedTask === task.id ? <ChevronUp size="16" /> : <ChevronDown size="16" />}
                        </div>

                        {expandedTask === task.id && (
                          <div className="border-t bg-gray-50 p-3 space-y-4">
                            {task.comments && task.comments.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                  <MessageSquare size="12" /> {t('المحادثة', 'Chat')}
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {task.comments.map(c => (
                                    <div key={c.id} className="bg-white p-2 rounded text-sm">
                                      <p className="text-xs text-gray-400 mb-1">{c.user_name || 'User'}</p>
                                      <p className="text-gray-700">{c.message}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {task.attachments && task.attachments.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                  <Paperclip size="12" /> {t('المرفقات', 'Attachments')}
                                </h4>
                                <div className="space-y-1">
                                  {task.attachments.map(att => (
                                    <a
                                      key={att.id}
                                      href={`/${att.file_path.replace(/\\/g, '/')}`}
                                      target="_blank"
                                      className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-sm"
                                    >
                                      <Download size="12" className="text-gray-400" />
                                      <span className="text-gray-600">{att.file_name}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(!task.comments || task.comments.length === 0) && (!task.attachments || task.attachments.length === 0) && (
                              <p className="text-xs text-gray-400 text-center">{t('لا توجد تفاصيل', 'No details')}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}