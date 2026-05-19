import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Plus, HandCoins, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SalaryAdvances() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [advances, setAdvances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', reason: '', repayment_terms: '' });
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const load = () => {
    api.get(`/advances/${activeCompany}`).then(({ data }) => setAdvances(data)).catch(() => {});
  };

  useEffect(() => { load(); }, [activeCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error(t('الرجاء إدخال المبررات', 'Please enter justification')); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error(t('المبلغ غير صالح', 'Invalid amount')); return; }
    try {
      await api.post(`/advances/${activeCompany}`, form);
      toast.success(t('تم تقديم الطلب', 'Submitted'));
      setShowForm(false);
      setForm({ amount: '', reason: '', repayment_terms: '' });
      load();
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const handleReview = async (id, status) => {
    try {
      await api.put(`/advances/${activeCompany}/${id}/review`, { status });
      toast.success(t('تم التحديث', 'Updated'));
      load();
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const canReview = user?.role !== 'employee';
  const statusBadge = (s) => {
    const map = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', paid: 'bg-green-100 text-green-800' };
    return map[s] || 'badge-pending';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('سلف الراتب', 'Salary Advances')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة طلبات السلف', 'Manage advance requests')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18} /> {t('طلب سلفة', 'New Request')}</button>
      </div>

      <div className="space-y-3">
        {advances.map((a) => (
          <div key={a.id} className="card card-hover">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{a.user_name}</h3>
                  <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
                </div>
                <p className="text-lg font-bold text-primary-600">{a.amount?.toLocaleString()} {t('ريال', 'SAR')}</p>
                <p className="text-sm text-gray-600 mt-1"><strong>{t('المبررات', 'Justification')}:</strong> {a.reason}</p>
                {a.repayment_terms && <p className="text-sm text-gray-500"><strong>{t('شروط السداد', 'Repayment')}:</strong> {a.repayment_terms}</p>}
                {a.reviewed_by && <p className="text-xs text-gray-400 mt-1">{t('تمت المراجعة', 'Reviewed')}</p>}
              </div>
              {canReview && a.status === 'pending' && (
                <div className="flex gap-2 ms-4">
                  <button onClick={() => handleReview(a.id, 'approved')} className="btn-success text-xs px-3 py-1"><CheckCircle size="14" /></button>
                  <button onClick={() => handleReview(a.id, 'rejected')} className="btn-danger text-xs px-3 py-1"><XCircle size="14" /></button>
                  <button onClick={() => handleReview(a.id, 'paid')} className="btn-primary text-xs px-3 py-1">{t('دفع', 'Pay')}</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {advances.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <HandCoins size="48" className="mx-auto mb-3 opacity-30" />
            <p>{t('لا توجد طلبات سلف', 'No advance requests')}</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('طلب سلفة جديد', 'New Advance Request')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">{t('المبلغ *', 'Amount *')}</label>
                <input type="number" className="input" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} required min="1" placeholder={t('أدخل المبلغ', 'Enter amount')} />
              </div>
              <div>
                <label className="label">{t('المبررات *', 'Justification *')}</label>
                <textarea className="input" rows="3" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} required placeholder={t('اذكر سبب طلب السلفة', 'Provide justification for advance')} />
              </div>
              <div>
                <label className="label">{t('شروط السداد', 'Repayment Terms')}</label>
                <textarea className="input" rows="2" value={form.repayment_terms} onChange={(e) => setForm({...form, repayment_terms: e.target.value})} placeholder={t('مثال: تقسيط على 3 أشهر', 'E.g., Installment over 3 months')} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('إرسال', 'Submit')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
