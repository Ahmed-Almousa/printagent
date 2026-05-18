import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Search, X, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const COMPANY_TABS = [
  { slug: 'printing', labelAr: 'المطبعة', labelEn: 'Printing', color: 'border-blue-500 text-blue-700 bg-blue-50' },
  { slug: 'advertising', labelAr: 'الوكالة', labelEn: 'Agency', color: 'border-green-500 text-green-700 bg-green-50' },
];

export default function CashMovement() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [companyTab, setCompanyTab] = useState(activeCompany || 'printing');
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState({ in: 0, out: 0, balance: 0 });
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState('in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [referenceType, setReferenceType] = useState('');
  const [filter, setFilter] = useState('all');
  const [editTx, setEditTx] = useState(null);
  const [dateRange, setDateRange] = useState({ from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    if (!isSuperAdmin && activeCompany) setCompanyTab(activeCompany);
  }, [activeCompany, isSuperAdmin]);

  const loadData = useCallback(async () => {
    const slug = companyTab;
    if (!slug) return;
    try {
      const { from, to } = dateRange;
      const txRes = await api.get(`/cash/range/${slug}?from=${from}&to=${to}`);
      console.log('loadData response:', txRes.data);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      let totalIn = 0, totalOut = 0;
      (Array.isArray(txRes.data) ? txRes.data : []).forEach(tx => {
        if (tx.type === 'in') totalIn += tx.amount;
        else totalOut += tx.amount;
      });
      setBalance({ in: totalIn, out: totalOut, balance: totalIn - totalOut });
    } catch (err) {
      console.error('loadData error:', err);
      toast.error(t('فشل تحميل البيانات', 'Failed to load data'));
    }
  }, [companyTab, dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error(t('المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero'));
      return;
    }
    const slug = companyTab;
    if (!slug) { toast.error(t('خطأ في تحديد الشركة', 'Company error')); return; }
    try {
      const res = await api.post(`/cash/${slug}`, {
        type: txType, amount: parseFloat(amount), description, category, reference_type: referenceType || null,
      });
      if (!res.data) throw new Error('No data returned');
      setShowModal(false);
      resetForm();
      toast.success(t('تم التسجيل', 'Recorded'));
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || t('فشل الحفظ', 'Save failed');
      toast.error(msg);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error(t('المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero'));
      return;
    }
    const slug = companyTab;
    if (!slug || !editTx) return;
    try {
      await api.put(`/cash/${slug}/${editTx.id}`, {
        type: txType, amount: parseFloat(amount), description, category, reference_type: referenceType || null,
      });
      setShowModal(false);
      setEditTx(null);
      resetForm();
      toast.success(t('تم التحديث', 'Updated'));
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل التحديث', 'Update failed'));
    }
  };

  const handleDelete = async (tx) => {
    if (!confirm(t('هل أنت متأكد من حذف هذه الحركة؟', 'Delete this transaction?'))) return;
    const slug = companyTab;
    if (!slug) return;
    try {
      await api.delete(`/cash/${slug}/${tx.id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل الحذف', 'Delete failed'));
    }
  };

  const handleDuplicate = (tx) => {
    setTxType(tx.type);
    setAmount(String(tx.amount));
    setDescription(tx.description || '');
    setCategory(tx.category || '');
    setReferenceType(tx.reference_type || '');
    setEditTx(null);
    setShowModal(true);
  };

  const openEdit = (tx) => {
    setEditTx(tx);
    setTxType(tx.type);
    setAmount(String(tx.amount));
    setDescription(tx.description || '');
    setCategory(tx.category || '');
    setReferenceType(tx.reference_type || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCategory('');
    setReferenceType('');
    setTxType('in');
    setEditTx(null);
  };

  const categories = t(
    ['مبيعات', 'مشتريات', 'رواتب', 'سلف', 'مصاريف تشغيل', 'مصاريف إدارية', 'أخرى'],
    ['Sales', 'Purchases', 'Payroll', 'Advances', 'Operating Expenses', 'Admin Expenses', 'Other']
  );

  const visibleTabs = isSuperAdmin ? COMPANY_TABS : COMPANY_TABS.filter(c => c.slug === activeCompany);

  let runningBalance = 0;
  const txWithBalance = transactions.map(tx => {
    runningBalance += tx.type === 'in' ? tx.amount : -tx.amount;
    return { ...tx, runningBalance };
  });

  const filteredTx = filter === 'all' ? txWithBalance : txWithBalance.filter(tx => tx.type === filter);

  const groupedTx = filteredTx.reduce((acc, tx) => {
    const key = tx.type === 'in' ? 'in' : 'out';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet size="24" className="text-blue-600" /> {t('الحركة اليومية', 'Daily Cash Movement')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('تسجيل ومتابعة المعاملات النقدية', 'Record & track cash transactions')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
          + {t('عملية نقدية', 'New Transaction')}
        </button>
      </div>

      {/* Company Tabs */}
      {isSuperAdmin && (
        <div className="flex gap-2">
          {visibleTabs.map(ct => (
            <button key={ct.slug} onClick={() => setCompanyTab(ct.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                companyTab === ct.slug
                  ? ct.color + ' border-current'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Building2 size={16} className="inline mr-1" /> {t(ct.labelAr, ct.labelEn)}
            </button>
          ))}
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <ArrowDownCircle size="18" /> <span className="text-sm font-medium">{t('المقبوض', 'Cash In')}</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{balance.in.toLocaleString()} {t('ر.س', 'SAR')}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-700 mb-1">
            <ArrowUpCircle size="18" /> <span className="text-sm font-medium">{t('المدفوع', 'Cash Out')}</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{balance.out.toLocaleString()} {t('ر.س', 'SAR')}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <Wallet size="18" /> <span className="text-sm font-medium">{t('رصيد الصندوق', 'Cash Balance')}</span>
          </div>
          <p className={`text-2xl font-bold ${balance.balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {balance.balance.toLocaleString()} {t('ر.س', 'SAR')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">{t('الفترة', 'Period')}:</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-gray-400">{t('إلى', 'to')}</span>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          <div className="h-6 w-px bg-gray-200 mx-2" />
          <div className="flex gap-1">
            {[
              { key: 'all', labelAr: 'الكل', labelEn: 'All' },
              { key: 'in', labelAr: 'مقبوضات', labelEn: 'In' },
              { key: 'out', labelAr: 'مدفوعات', labelEn: 'Out' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{t(f.labelAr, f.labelEn)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('#', '#')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('الوقت', 'Time')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('النوع', 'Type')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('البيان', 'Description')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('التصنيف', 'Category')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('المبلغ', 'Amount')}</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">{t('الرصيد', 'Balance')}</th>
                <th className="px-2 py-3 text-center text-gray-600 font-medium">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">{t('لا توجد معاملات', 'No transactions')}</td></tr>
              ) : (
                <>
                  {groupedTx.in && (
                    <>
                      <tr className="bg-green-50/50"><td colSpan="8" className="px-4 py-2 text-xs font-bold text-green-700">{t('المقبوضات', 'Cash In')}</td></tr>
                      {groupedTx.in.map((tx, idx) => (
                        <tr key={tx.id} className="border-b border-gray-100 hover:bg-green-50/30 transition-colors">
                          <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                            {format(new Date(tx.created_at), 'HH:mm:ss')}
                            <span className="text-gray-400 text-xs mr-1">{format(new Date(tx.created_at), 'dd/MM')}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <ArrowDownCircle size="12" /> {t('قبض', 'In')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{tx.description || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{tx.category || '-'}</td>
                          <td className="px-4 py-2.5 font-medium text-green-700">{tx.amount.toLocaleString()} {t('ر.س', 'SAR')}</td>
                          <td className="px-4 py-2.5 font-medium text-blue-700">{tx.runningBalance.toLocaleString()} {t('ر.س', 'SAR')}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(tx)} className="p-1 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700 transition-colors" title={t('تعديل', 'Edit')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => handleDuplicate(tx)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title={t('تكرار', 'Duplicate')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                              <button onClick={() => handleDelete(tx)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors" title={t('حذف', 'Delete')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {groupedTx.out && (
                    <>
                      <tr className="bg-red-50/50"><td colSpan="8" className="px-4 py-2 text-xs font-bold text-red-700">{t('المدفوعات', 'Cash Out')}</td></tr>
                      {groupedTx.out.map((tx, idx) => (
                        <tr key={tx.id} className="border-b border-gray-100 hover:bg-red-50/30 transition-colors">
                          <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                            {format(new Date(tx.created_at), 'HH:mm:ss')}
                            <span className="text-gray-400 text-xs mr-1">{format(new Date(tx.created_at), 'dd/MM')}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <ArrowUpCircle size="12" /> {t('صرف', 'Out')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{tx.description || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{tx.category || '-'}</td>
                          <td className="px-4 py-2.5 font-medium text-red-700">{tx.amount.toLocaleString()} {t('ر.س', 'SAR')}</td>
                          <td className="px-4 py-2.5 font-medium text-blue-700">{tx.runningBalance.toLocaleString()} {t('ر.س', 'SAR')}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(tx)} className="p-1 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700 transition-colors" title={t('تعديل', 'Edit')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => handleDuplicate(tx)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title={t('تكرار', 'Duplicate')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                              <button onClick={() => handleDelete(tx)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors" title={t('حذف', 'Delete')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium border-t-2 border-gray-300">
                <td colSpan="5" className="px-4 py-3 text-right text-gray-700">{t('الإجمالي', 'Total')}</td>
                <td className={`px-4 py-3 ${balance.in >= balance.out ? 'text-green-700' : 'text-red-700'}`}>
                  {balance.in.toLocaleString()} {t('ر.س', 'SAR')}
                </td>
                <td className={`px-4 py-3 ${balance.balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {balance.balance.toLocaleString()} {t('ر.س', 'SAR')}
                </td>
                <td className="px-2 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add/Edit Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">{editTx ? t('تعديل عملية نقدية', 'Edit Transaction') : t('عملية نقدية جديدة', 'New Transaction')}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded"><X size="20" /></button>
            </div>
            <form onSubmit={editTx ? handleUpdate : handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setTxType('in')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    txType === 'in' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'
                  }`}
                ><ArrowDownCircle size="16" className="inline mr-1" /> {t('قبض', 'Cash In')}</button>
                <button type="button" onClick={() => setTxType('out')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    txType === 'out' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                  }`}
                ><ArrowUpCircle size="16" className="inline mr-1" /> {t('صرف', 'Cash Out')}</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('المبلغ', 'Amount')} *</label>
                <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00" dir="ltr" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('البيان', 'Description')}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows="2"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('وصف العملية', 'Transaction description')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('التصنيف', 'Category')}</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('-- اختر --', '-- Select --')}</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('نوع المرجع', 'Reference Type')}</label>
                <select value={referenceType} onChange={e => setReferenceType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('-- بدون --', '-- None --')}</option>
                  <option value="invoice">{t('فاتورة', 'Invoice')}</option>
                  <option value="payroll">{t('راتب', 'Payroll')}</option>
                  <option value="advance">{t('سلفة', 'Advance')}</option>
                  <option value="expense">{t('مصروف', 'Expense')}</option>
                  <option value="other">{t('أخرى', 'Other')}</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                    txType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >{editTx ? t('تحديث', 'Update') : t('تسجيل', 'Record')}</button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
