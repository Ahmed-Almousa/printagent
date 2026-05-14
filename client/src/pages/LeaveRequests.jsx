import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Plus, CalendarCheck, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeaveRequests() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' });
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const load = () => {
    api.get(`/leave/${activeCompany}`).then(({ data }) => setLeaves(data)).catch(() => {});
  };

  useEffect(() => { load(); }, [activeCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error(t('الرجاء إدخال السبب', 'Please enter a reason')); return; }
    try {
      await api.post(`/leave/${activeCompany}`, form);
      toast.success(t('تم تقديم الطلب', 'Request submitted'));
      setShowForm(false);
      setForm({ type: 'annual', start_date: '', end_date: '', reason: '' });
      load();
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const handleReview = async (id, status) => {
    try {
      await api.put(`/leave/${activeCompany}/${id}/review`, { status });
      toast.success(status === 'approved' ? t('تمت الموافقة', 'Approved') : t('تم الرفض', 'Rejected'));
      load();
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const canReview = user?.role !== 'employee';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('طلبات الإجازة', 'Leave Requests')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة إجازات الموظفين', 'Manage employee leave')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18} /> {t('طلب إجازة', 'New Request')}</button>
      </div>

      <div className="space-y-3">
        {leaves.map((l) => (
          <div key={l.id} className="card card-hover">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{l.user_name}</h3>
                  <span className={`badge text-[10px] ${l.type === 'annual' ? 'bg-blue-100 text-blue-700' : l.type === 'sick' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                    {l.type === 'annual' ? t('سنوية', 'Annual') : l.type === 'sick' ? t('مرضية', 'Sick') : t('شخصية', 'Personal')}
                  </span>
                  <span className={`badge ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {l.status === 'approved' ? t('مقبولة', 'Approved') : l.status === 'rejected' ? t('مرفوضة', 'Rejected') : t('قيد الانتظار', 'Pending')}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{l.start_date} → {l.end_date}</p>
                <p className="text-sm text-gray-600 mt-1"><strong>{t('السبب', 'Reason')}:</strong> {l.reason}</p>
              </div>
              {canReview && l.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleReview(l.id, 'approved')} className="btn-success text-xs px-3 py-1"><CheckCircle size="14" /></button>
                  <button onClick={() => handleReview(l.id, 'rejected')} className="btn-danger text-xs px-3 py-1"><XCircle size="14" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {leaves.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <CalendarCheck size="48" className="mx-auto mb-3 opacity-30" />
            <p>{t('لا توجد طلبات إجازة', 'No leave requests')}</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('طلب إجازة جديد', 'New Leave Request')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">{t('النوع', 'Type')}</label>
                <select className="select" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                  <option value="annual">{t('سنوية', 'Annual')}</option>
                  <option value="sick">{t('مرضية', 'Sick')}</option>
                  <option value="personal">{t('شخصية', 'Personal')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('من تاريخ', 'From')}</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({...form, start_date: e.target.value})} required /></div>
                <div><label className="label">{t('إلى تاريخ', 'To')}</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({...form, end_date: e.target.value})} required /></div>
              </div>
              <div>
                <label className="label">{t('السبب/التبرير *', 'Reason/Justification *')}</label>
                <textarea className="input" rows="3" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} required placeholder={t('اذكر سبب طلب الإجازة', 'Provide reason for leave')} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('إرسال الطلب', 'Submit')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
