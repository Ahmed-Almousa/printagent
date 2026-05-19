import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building2, Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const COMPANY_TABS = [
  { slug: 'printing', labelAr: 'المطبعة', labelEn: 'Printing', color: 'border-blue-500 text-blue-700 bg-blue-50' },
  { slug: 'advertising', labelAr: 'الوكالة', labelEn: 'Agency', color: 'border-green-500 text-green-700 bg-green-50' },
  { slug: 'combined', labelAr: 'إجمالي', labelEn: 'Combined', color: 'border-purple-500 text-purple-700 bg-purple-50' },
];

export default function Finances() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const isSuperAdmin = user?.role === 'super_admin';
  const [companyTab, setCompanyTab] = useState(isSuperAdmin ? 'combined' : activeCompany);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('overview');

  const hasPerm = (perm) => {
    if (!user || !user.permissions) return false;
    if (user.role === 'super_admin') return true;
    const perms = user.permissions.split(',').map(p => p.trim());
    return perms.includes(perm);
  };
  const canPayroll = hasPerm('payroll.view_own') || hasPerm('payroll.view_all') || hasPerm('finances.payroll_view_own') || hasPerm('finances.payroll_view_all') || hasPerm('finances.payroll_manage');
  const canInvoices = hasPerm('finances.invoices_view') || hasPerm('finances.invoices_create') || hasPerm('finances.invoices_delete');
  const canReports = hasPerm('finances.reports_view') || hasPerm('payroll.view_all');

  const loadSummary = async (slug) => {
    const year = new Date().getFullYear();
    const { data } = await api.get(`/finances/${slug}/summary?year=${year}`);
    return data;
  };

  useEffect(() => {
    if (companyTab === 'combined' && isSuperAdmin) {
      Promise.all([loadSummary('printing'), loadSummary('advertising')]).then(([p, a]) => {
        setSummary({
          totalRevenue: (p?.totalRevenue || 0) + (a?.totalRevenue || 0),
          totalExpenses: (p?.totalExpenses || 0) + (a?.totalExpenses || 0),
          payrollTotal: (p?.payrollTotal || 0) + (a?.payrollTotal || 0),
          projectRevenue: (p?.projectRevenue || 0) + (a?.projectRevenue || 0),
          cashIn: (p?.cashIn || 0) + (a?.cashIn || 0),
          cashOut: (p?.cashOut || 0) + (a?.cashOut || 0),
          netBalance: (p?.netBalance || 0) + (a?.netBalance || 0),
        });
      }).catch(() => setSummary(null));
    } else if (companyTab) {
      loadSummary(companyTab).then(setSummary).catch(() => setSummary(null));
    }
    const firstTab = canPayroll ? 'payroll' : canInvoices ? 'invoices' : canReports ? 'reports' : 'payroll';
    setTab(prev => prev === 'overview' ? firstTab : prev);
  }, [companyTab]);

  const visibleTabs = isSuperAdmin ? COMPANY_TABS : COMPANY_TABS.filter(c => c.slug === activeCompany);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign size="24" className="text-green-600" /> {t('المالية', 'Finances')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة الإيرادات والمصاريف', 'Manage income & expenses')}</p>
        </div>
      </div>

      {/* Company Tabs */}
      <div className="flex gap-2">
        {visibleTabs.map(ct => (
          <button
            key={ct.slug}
            onClick={() => setCompanyTab(ct.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              companyTab === ct.slug
                ? ct.color + ' border-current'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Building2 size="16" className="inline me-1" />
            {t(ct.labelAr, ct.labelEn)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><TrendingUp size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalRevenue?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('إيرادات الفواتير', 'Invoice Revenue')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><TrendingDown size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalExpenses?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('مصاريف الفواتير', 'Invoice Expenses')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowDownCircle size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.cashIn?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('المقبوضات النقدية', 'Cash In')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><ArrowUpCircle size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-rose-700">{summary.cashOut?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('المدفوعات النقدية', 'Cash Out')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><Building2 size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.projectRevenue?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('قيمة المشاريع', 'Project Value')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Wallet size="18" /></div>
            </div>
            <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.netBalance?.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">{t('صافي الرصيد', 'Net Balance')}</p>
          </div>
        </div>
      )}

      {/* Feature Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          canPayroll && { key: 'payroll', labelAr: 'الرواتب', labelEn: 'Payroll' },
          canInvoices && { key: 'invoices', labelAr: 'الفواتير', labelEn: 'Invoices' },
          canReports && { key: 'reports', labelAr: 'التقارير', labelEn: 'Reports' },
        ].filter(Boolean).map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tabItem.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(tabItem.labelAr, tabItem.labelEn)}
          </button>
        ))}
      </div>

      {/* Tab Content - combined uses slugs, single uses companyTab */}
      {tab === 'payroll' && <PayrollTab companySlug={companyTab === 'combined' ? null : companyTab} lang={lang} t={t} isCombined={companyTab === 'combined'} />}
      {tab === 'invoices' && <InvoicesTab companySlug={companyTab === 'combined' ? null : companyTab} lang={lang} t={t} isCombined={companyTab === 'combined'} />}
      {tab === 'reports' && <ReportsTab companySlug={companyTab === 'combined' ? null : companyTab} lang={lang} t={t} isCombined={companyTab === 'combined'} />}
    </div>
  );
}

function PayrollTab({ companySlug, lang, t, isCombined }) {
  const [employeesData, setEmployeesData] = useState([]);

  const loadPayroll = (slug) => {
    api.get(`/payroll/${slug}`).then(({ data }) => setEmployeesData(data)).catch(() => {});
  };

  useEffect(() => {
    if (isCombined) {
      Promise.all([
        api.get('/payroll/printing').then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
        api.get('/payroll/advertising').then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
      ]).then(([p, a]) => setEmployeesData([...p, ...a])).catch(() => {});
    } else {
      loadPayroll(companySlug);
    }
  }, [companySlug, isCombined]);

  const handlePay = async (id, slug) => {
    try { await api.put(`/payroll/${slug || companySlug}/${id}/pay`); isCombined ? setEmployeesData(prev => prev.filter(r => r.id !== id)) : loadPayroll(companySlug); }
    catch (err) { alert(t('فشل', 'Failed')); }
  };

  const handleCalculate = async () => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    try {
      if (isCombined) {
        await api.post('/payroll/printing/calculate', { month, year });
        await api.post('/payroll/advertising/calculate', { month, year });
        const [p, a] = await Promise.all([
          api.get('/payroll/printing').then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
          api.get('/payroll/advertising').then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
        ]);
        setEmployeesData([...p, ...a]);
      } else {
        await api.post(`/payroll/${companySlug}/calculate`, { month, year });
        loadPayroll(companySlug);
      }
    } catch (err) { alert(t('فشل', 'Failed')); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">{t('كشف الرواتب', 'Payroll')}</h3>
        <button onClick={handleCalculate} className="btn-primary text-sm py-1.5">{t('احتساب الرواتب', 'Calculate Payroll')}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الموظف', 'Employee')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشهر', 'Month')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الراتب الأساسي', 'Base Salary')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('السلف', 'Advances')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الخصومات', 'Deductions')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الصافي', 'Net')}</th>
              <th className="text-center py-2 px-2 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {employeesData.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                {isCombined && (
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${row._company === 'printing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {row._company === 'printing' ? t('مطبعة', 'Print') : t('وكالة', 'Agency')}
                    </span>
                  </td>
                )}
                <td className="py-2 px-2 font-medium">{row.user_name || row.user_id}</td>
                <td className="py-2 px-2">{row.month}/{row.year}</td>
                <td className="py-2 px-2">{row.base_salary?.toLocaleString()}</td>
                <td className="py-2 px-2 text-orange-600">{row.advances_deducted?.toLocaleString()}</td>
                <td className="py-2 px-2 text-red-600">{((row.deductions||0)+(row.late_penalties||0)).toLocaleString()}</td>
                <td className="py-2 px-2 font-bold">{row.net_salary?.toLocaleString()}</td>
                <td className="py-2 px-2 text-center">
                  {row.status === 'paid' ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{t('تم التقبيض', 'Paid')}</span>
                  ) : (
                    <button onClick={() => handlePay(row.id, row._company)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                      {t('تقبيض', 'Pay')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {employeesData.length === 0 && (
              <tr><td colSpan={isCombined ? 8 : 7} className="text-center py-8 text-gray-400">{t('لا توجد بيانات رواتب', 'No payroll data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoicesTab({ companySlug, lang, t, isCombined }) {
  const [invoices, setInvoices] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'sale', invoice_number: '', vendor_client_name: '', amount: '', description: '', invoice_date: new Date().toISOString().split('T')[0] });

  const loadInvoices = (slug) => {
    const params = filterType ? `?type=${filterType}` : '';
    api.get(`/finances/${slug}/invoices${params}`).then(({ data }) => setInvoices(data)).catch(() => {});
  };

  useEffect(() => {
    if (isCombined) {
      Promise.all([
        api.get(`/finances/printing/invoices${filterType ? `?type=${filterType}` : ''}`).then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
        api.get(`/finances/advertising/invoices${filterType ? `?type=${filterType}` : ''}`).then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
      ]).then(([p, a]) => setInvoices([...p, ...a])).catch(() => {});
    } else {
      loadInvoices(companySlug);
    }
  }, [companySlug, filterType, isCombined]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const slug = isCombined ? 'printing' : companySlug;
    try {
      await api.post(`/finances/${slug}/invoices`, form);
      setShowForm(false);
      setForm({ type: 'sale', invoice_number: '', vendor_client_name: '', amount: '', description: '', invoice_date: new Date().toISOString().split('T')[0] });
      isCombined ? setInvoices(prev => [...prev, { ...form, _company: slug, id: 'temp_' + Date.now() }]) : loadInvoices(companySlug);
    } catch (err) { alert(t('فشل', 'Failed')); }
  };

  const handleDelete = async (id, slug) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try { await api.delete(`/finances/${slug || companySlug}/invoices/${id}`); isCombined ? setInvoices(prev => prev.filter(inv => inv.id !== id)) : loadInvoices(companySlug); }
    catch (err) { alert(t('فشل', 'Failed')); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <select className="select w-32 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">{t('الكل', 'All')}</option>
            <option value="sale">{t('مبيع', 'Sale')}</option>
            <option value="purchase">{t('شراء', 'Purchase')}</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-1.5">
          <Plus size="16" className="inline me-1" />{t('فاتورة جديدة', 'New Invoice')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('رقم الفاتورة', 'Invoice #')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('النوع', 'Type')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الطرف', 'Party')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('المبلغ', 'Amount')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('التاريخ', 'Date')}</th>
              <th className="text-center py-2 px-2 font-medium text-gray-600">{t('حذف', 'Delete')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                {isCombined && (
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${inv._company === 'printing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {inv._company === 'printing' ? t('مطبعة', 'Print') : t('وكالة', 'Agency')}
                    </span>
                  </td>
                )}
                <td className="py-2 px-2 text-gray-500">{inv.invoice_number || '-'}</td>
                <td className="py-2 px-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${inv.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {inv.type === 'sale' ? t('مبيع', 'Sale') : t('شراء', 'Purchase')}
                  </span>
                </td>
                <td className="py-2 px-2 font-medium">{inv.vendor_client_name}</td>
                <td className="py-2 px-2 font-bold">{inv.amount?.toLocaleString()}</td>
                <td className="py-2 px-2 text-gray-500">{inv.invoice_date || '-'}</td>
                <td className="py-2 px-2 text-center">
                  <button onClick={() => handleDelete(inv.id, inv._company)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size="14" /></button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={isCombined ? 7 : 6} className="text-center py-8 text-gray-400">{t('لا توجد فواتير', 'No invoices')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('فاتورة جديدة', 'New Invoice')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('النوع', 'Type')}</label>
                  <select className="select" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                    <option value="sale">{t('مبيع', 'Sale')}</option>
                    <option value="purchase">{t('شراء', 'Purchase')}</option>
                  </select>
                </div>
                <div><label className="label">{t('رقم الفاتورة', 'Invoice #')}</label><input className="input" value={form.invoice_number} onChange={(e) => setForm({...form, invoice_number: e.target.value})} /></div>
              </div>
              <div><label className="label">{t('الطرف', 'Vendor/Client')}</label><input className="input" value={form.vendor_client_name} onChange={(e) => setForm({...form, vendor_client_name: e.target.value})} required /></div>
              <div><label className="label">{t('المبلغ', 'Amount')}</label><input type="number" className="input" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} required /></div>
              <div><label className="label">{t('الوصف', 'Description')}</label><textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div><label className="label">{t('التاريخ', 'Date')}</label><input type="date" className="input" value={form.invoice_date} onChange={(e) => setForm({...form, invoice_date: e.target.value})} /></div>
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

function ReportsTab({ companySlug, lang, t, isCombined }) {
  const [reports, setReports] = useState([]);
  const year = new Date().getFullYear();
  const monthNames = lang === 'ar'
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    if (isCombined) {
      Promise.all([
        api.get(`/finances/printing/reports?year=${year}`).then(r => r.data),
        api.get(`/finances/advertising/reports?year=${year}`).then(r => r.data),
      ]).then(([p, a]) => {
        const merged = [];
        for (let m = 1; m <= 12; m++) {
          const pMonth = p.find(r => r.month === m) || { income: 0, expenses: 0, payroll: 0, cash_in: 0, cash_out: 0 };
          const aMonth = a.find(r => r.month === m) || { income: 0, expenses: 0, payroll: 0, cash_in: 0, cash_out: 0 };
          merged.push({
            month: m,
            income: (pMonth.income || 0) + (aMonth.income || 0),
            expenses: (pMonth.expenses || 0) + (aMonth.expenses || 0),
            payroll: (pMonth.payroll || 0) + (aMonth.payroll || 0),
            cash_in: (pMonth.cash_in || 0) + (aMonth.cash_in || 0),
            cash_out: (pMonth.cash_out || 0) + (aMonth.cash_out || 0),
            net: (pMonth.income || 0) + (aMonth.income || 0) - (pMonth.expenses || 0) - (aMonth.expenses || 0) - (pMonth.payroll || 0) - (aMonth.payroll || 0),
          });
        }
        setReports(merged);
      }).catch(() => {});
    } else {
      api.get(`/finances/${companySlug}/reports?year=${year}`).then(({ data }) => setReports(data)).catch(() => {});
    }
  }, [companySlug, isCombined]);

  return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">{t('التقارير الشهرية', 'Monthly Reports')} — {year}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشهر', 'Month')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('إجمالي الدخل', 'Total Income')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('إجمالي المصاريف', 'Total Expenses')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الرواتب', 'Payroll')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('مقبوضات نقدية', 'Cash In')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('مدفوعات نقدية', 'Cash Out')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('صافي التدفق', 'Net Flow')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">{monthNames[r.month - 1]}</td>
                  <td className="py-2 px-2 text-green-600 font-medium">{r.income?.toLocaleString()}</td>
                  <td className="py-2 px-2 text-red-600 font-medium">{r.expenses?.toLocaleString()}</td>
                  <td className="py-2 px-2 text-orange-600">{r.payroll?.toLocaleString()}</td>
                  <td className="py-2 px-2 text-emerald-600 font-medium">{r.cash_in?.toLocaleString()}</td>
                  <td className="py-2 px-2 text-rose-600 font-medium">{r.cash_out?.toLocaleString()}</td>
                  <td className={`py-2 px-2 font-bold ${r.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {r.net?.toLocaleString()}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">{t('لا توجد بيانات', 'No data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}