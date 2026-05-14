import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building2, Plus, Trash2 } from 'lucide-react';

export default function Finances() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('overview');
  const isPrinting = activeCompany === 'printing';

  const hasPerm = (perm) => {
    if (!user || !user.permissions) return false;
    if (user.role === 'super_admin') return true;
    const perms = user.permissions.split(',').map(p => p.trim());
    return perms.includes(perm);
  };
  const canPayroll = hasPerm('payroll.view_own') || hasPerm('payroll.view_all') || hasPerm('finances.payroll_view_own') || hasPerm('finances.payroll_view_all') || hasPerm('finances.payroll_manage');
  const canInvoices = hasPerm('finances.invoices_view') || hasPerm('finances.invoices_create') || hasPerm('finances.invoices_delete');
  const canReports = hasPerm('finances.reports_view') || hasPerm('payroll.view_all');

  useEffect(() => {
    const year = new Date().getFullYear();
    api.get(`/finances/${activeCompany}/summary?year=${year}`).then(({ data }) => setSummary(data)).catch(() => {});
    const firstTab = canPayroll ? 'payroll' : canInvoices ? 'invoices' : canReports ? 'reports' : 'payroll';
    setTab(prev => prev === 'overview' ? firstTab : prev);
  }, [activeCompany]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign size="24" className="text-green-600" /> {t('المالية', 'Finances')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة الإيرادات والمصاريف', 'Manage income & expenses')}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${isPrinting ? 'bg-blue-600' : 'bg-green-600'}`}>
          <Building2 size="16" className="inline ml-1" />
          {isPrinting ? t('المطبعة', 'Printing Press') : t('الوكالة الإعلانية', 'Advertising Agency')}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><TrendingUp size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalRevenue?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('إجمالي الإيرادات', 'Total Revenue')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><TrendingDown size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalExpenses?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('إجمالي المصاريف', 'Total Expenses')}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><Building2 size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.payrollTotal?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('إجمالي الرواتب', 'Total Payroll')}</p>
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

      {/* Tabs */}
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

      {/* Tab Content */}
      {tab === 'payroll' && <PayrollTab companySlug={activeCompany} lang={lang} t={t} />}
      {tab === 'invoices' && <InvoicesTab companySlug={activeCompany} lang={lang} t={t} />}
      {tab === 'reports' && <ReportsTab companySlug={activeCompany} lang={lang} t={t} />}
    </div>
  );
}

/* ───── PAYROLL TAB ───── */
function PayrollTab({ companySlug, lang, t }) {
  const [employeesData, setEmployeesData] = useState([]);

  const loadPayroll = () => {
    api.get(`/payroll/${companySlug}`).then(({ data }) => setEmployeesData(data)).catch(() => {});
  };

  useEffect(() => { loadPayroll(); }, [companySlug]);

  const handlePay = async (id) => {
    try {
      await api.put(`/payroll/${companySlug}/${id}/pay`);
      loadPayroll();
    } catch (err) { alert(t('فشل', 'Failed')); }
  };

  const handleCalculate = async () => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    try {
      await api.post(`/payroll/${companySlug}/calculate`, { month, year });
      loadPayroll();
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
                    <button onClick={() => handlePay(row.id)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                      {t('تقبيض', 'Pay')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {employeesData.length === 0 && (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">{t('لا توجد بيانات رواتب', 'No payroll data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───── INVOICES TAB ───── */
function InvoicesTab({ companySlug, lang, t }) {
  const [invoices, setInvoices] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'sale', invoice_number: '', vendor_client_name: '', amount: '', description: '', invoice_date: new Date().toISOString().split('T')[0] });

  const loadInvoices = () => {
    const params = filterType ? `?type=${filterType}` : '';
    api.get(`/finances/${companySlug}/invoices${params}`).then(({ data }) => setInvoices(data)).catch(() => {});
  };

  useEffect(() => { loadInvoices(); }, [companySlug, filterType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/finances/${companySlug}/invoices`, form);
      setShowForm(false);
      setForm({ type: 'sale', invoice_number: '', vendor_client_name: '', amount: '', description: '', invoice_date: new Date().toISOString().split('T')[0] });
      loadInvoices();
    } catch (err) { alert(t('فشل', 'Failed')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try { await api.delete(`/finances/${companySlug}/invoices/${id}`); loadInvoices(); }
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
          <Plus size="16" className="inline ml-1" />{t('فاتورة جديدة', 'New Invoice')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
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
                  <button onClick={() => handleDelete(inv.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size="14" /></button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">{t('لا توجد فواتير', 'No invoices')}</td></tr>
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

/* ───── REPORTS TAB ───── */
function ReportsTab({ companySlug, lang, t }) {
  const [reports, setReports] = useState([]);
  const year = new Date().getFullYear();
  const monthNames = lang === 'ar'
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    api.get(`/finances/${companySlug}/reports?year=${year}`).then(({ data }) => setReports(data)).catch(() => {});
  }, [companySlug]);

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
                <td className={`py-2 px-2 font-bold ${r.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {r.net?.toLocaleString()}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan="5" className="text-center py-8 text-gray-400">{t('لا توجد بيانات', 'No data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}