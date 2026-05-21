import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building2, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Edit2, Copy, X, Search, Edit3, FileText, Printer, Package, BarChart3, AlertTriangle, Minus } from 'lucide-react';

const COMPANY_TABS = [
  { slug: 'printing', labelAr: 'المطبعة', labelEn: 'Printing', color: 'border-blue-500 text-blue-700 bg-blue-50' },
  { slug: 'advertising', labelAr: 'الوكالة', labelEn: 'Agency', color: 'border-green-500 text-green-700 bg-green-50' },
  { slug: 'combined', labelAr: 'إجمالي', labelEn: 'Combined', color: 'border-purple-500 text-purple-700 bg-purple-50' },
];

const FEATURE_TABS = [
  { key: 'sale_invoices', labelAr: 'فواتير المبيع', labelEn: 'Sale Invoices' },
  { key: 'purchase_invoices', labelAr: 'فواتير الشراء', labelEn: 'Purchase Invoices' },
  { key: 'items', labelAr: 'الأصناف', labelEn: 'Items' },
  { key: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory' },
  { key: 'payroll', labelAr: 'الرواتب', labelEn: 'Payroll' },
  { key: 'reports', labelAr: 'التقارير', labelEn: 'Reports' },
];

export default function Finances() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const isSuperAdmin = user?.role === 'super_admin';
  const [companyTab, setCompanyTab] = useState(isSuperAdmin ? 'combined' : activeCompany);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('sale_invoices');
  const [detailModal, setDetailModal] = useState(null);

  const hasPerm = (perm) => {
    if (!user || !user.permissions) return false;
    if (user.role === 'super_admin') return true;
    const perms = user.permissions.split(',').map(p => p.trim());
    return perms.includes(perm);
  };

  const canInvoices = hasPerm('finances.invoices_view') || hasPerm('finances.invoices_create') || hasPerm('finances.invoices_delete');
  const canPayroll = hasPerm('payroll.view_own') || hasPerm('payroll.view_all') || hasPerm('finances.payroll_view_own') || hasPerm('finances.payroll_view_all') || hasPerm('finances.payroll_manage');
  const canReports = hasPerm('finances.reports_view') || hasPerm('payroll.view_all');
  const canItems = hasPerm('finances.items_view') || hasPerm('finances.invoices_view') || isSuperAdmin;
  const canInventory = hasPerm('finances.inventory_view') || hasPerm('finances.invoices_view') || isSuperAdmin;

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
          netBalance: ((p?.cashIn || 0) + (a?.cashIn || 0) + (p?.totalRevenue || 0) + (a?.totalRevenue || 0)) - ((p?.cashOut || 0) + (a?.cashOut || 0) + (p?.totalExpenses || 0) + (a?.totalExpenses || 0) + (p?.payrollTotal || 0) + (a?.payrollTotal || 0)),
        });
      }).catch(() => setSummary(null));
    } else if (companyTab) {
      loadSummary(companyTab).then(setSummary).catch(() => setSummary(null));
    }
  }, [companyTab, isSuperAdmin]);

  useEffect(() => {
    if (!canInvoices && !canItems && !canInventory && canPayroll) setTab('payroll');
    else if (!canInvoices && !canItems && !canInventory && canReports) setTab('reports');
  }, []);

  const visibleTabs = isSuperAdmin ? COMPANY_TABS : COMPANY_TABS.filter(c => c.slug === activeCompany);

  const visibleFeatureTabs = FEATURE_TABS.filter(t => {
    if (t.key === 'sale_invoices' || t.key === 'purchase_invoices') return canInvoices || isSuperAdmin;
    if (t.key === 'items') return canItems || isSuperAdmin;
    if (t.key === 'inventory') return canInventory || isSuperAdmin;
    if (t.key === 'payroll') return canPayroll || isSuperAdmin;
    if (t.key === 'reports') return canReports || isSuperAdmin;
    return false;
  });

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

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('إيرادات الفواتير', 'Invoice Revenue'), value: summary.totalRevenue, items: [
            { label: t('فواتير مبيع', 'Sale Invoices'), value: summary.totalRevenue },
            { label: t('قيمة المشاريع', 'Project Value'), value: summary.projectRevenue },
          ]})}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><TrendingUp size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalRevenue?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('إيرادات الفواتير', 'Invoice Revenue')}</p>
          </div>
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('مصاريف الفواتير', 'Invoice Expenses'), value: summary.totalExpenses, items: [
            { label: t('فواتير شراء', 'Purchase Invoices'), value: summary.totalExpenses },
          ]})}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><TrendingDown size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.totalExpenses?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('مصاريف الفواتير', 'Invoice Expenses')}</p>
          </div>
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('المقبوضات النقدية', 'Cash In'), value: summary.cashIn, items: [
            { label: t('مقبوضات نقدية', 'Cash Receipts'), value: summary.cashIn },
          ]})}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowDownCircle size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.cashIn?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('المقبوضات النقدية', 'Cash In')}</p>
          </div>
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('المدفوعات النقدية', 'Cash Out'), value: summary.cashOut, items: [
            { label: t('مدفوعات نقدية', 'Cash Payments'), value: summary.cashOut },
          ]})}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><ArrowUpCircle size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-rose-700">{summary.cashOut?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('المدفوعات النقدية', 'Cash Out')}</p>
          </div>
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('قيمة المشاريع', 'Project Value'), value: summary.projectRevenue, items: [
            { label: t('إجمالي قيمة المشاريع', 'Total Project Value'), value: summary.projectRevenue },
          ]})}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><Building2 size="18" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary.projectRevenue?.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{t('قيمة المشاريع', 'Project Value')}</p>
          </div>
          <div className="card card-hover cursor-pointer" onClick={() => setDetailModal({ title: t('صافي الرصيد', 'Net Balance'), value: summary.netBalance, items: [
            { label: t('إيرادات الفواتير', 'Invoice Revenue'), value: summary.totalRevenue, color: 'text-green-600' },
            { label: t('المقبوضات النقدية', 'Cash In'), value: summary.cashIn, color: 'text-emerald-600' },
            { label: t('مصاريف الفواتير', 'Invoice Expenses'), value: summary.totalExpenses, color: 'text-red-600' },
            { label: t('المدفوعات النقدية', 'Cash Out'), value: summary.cashOut, color: 'text-rose-600' },
            { label: t('الرواتب', 'Payroll'), value: summary.payrollTotal, color: 'text-orange-600' },
          ]})}>
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

      {detailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{detailModal.title}</h2>
              <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size="20" /></button>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-4">{detailModal.value?.toLocaleString()}</p>
            <div className="space-y-2 border-t pt-3">
              {detailModal.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color || 'text-gray-800'}`}>{item.value?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {visibleFeatureTabs.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === tabItem.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(tabItem.labelAr, tabItem.labelEn)}
          </button>
        ))}
      </div>

      {tab === 'sale_invoices' && <InvoiceListTab type="sale" companySlug={companyTab === 'combined' ? activeCompany : companyTab} isCombined={companyTab === 'combined'} lang={lang} t={t} />}
      {tab === 'purchase_invoices' && <InvoiceListTab type="purchase" companySlug={companyTab === 'combined' ? activeCompany : companyTab} isCombined={companyTab === 'combined'} lang={lang} t={t} />}
      {tab === 'items' && <ItemsTab companySlug={companyTab === 'combined' ? null : companyTab} isCombined={companyTab === 'combined'} lang={lang} t={t} />}
      {tab === 'inventory' && <InventoryTab companySlug={companyTab === 'combined' ? null : companyTab} isCombined={companyTab === 'combined'} lang={lang} t={t} />}
      {tab === 'payroll' && <PayrollTab companySlug={companyTab === 'combined' ? null : companyTab} lang={lang} t={t} isCombined={companyTab === 'combined'} />}
      {tab === 'reports' && <ReportsTab companySlug={companyTab === 'combined' ? null : companyTab} lang={lang} t={t} isCombined={companyTab === 'combined'} />}
    </div>
  );
}

function InvoiceListTab({ type, companySlug, isCombined, lang, t }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);

  const loadInvoices = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('type', type);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();

    try {
      if (isCombined) {
        const [p, a] = await Promise.all([
          api.get(`/invoicing/printing/invoices?${qs}`).then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
          api.get(`/invoicing/advertising/invoices?${qs}`).then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
        ]);
        setInvoices([...p, ...a]);
      } else {
        const { data } = await api.get(`/invoicing/${companySlug}/invoices?${qs}`);
        setInvoices(data);
      }
    } catch {
      toast.error(t('فشل في تحميل الفواتير', 'Failed to load invoices'));
    }
    setLoading(false);
  };

  useEffect(() => { loadInvoices(); }, [companySlug, dateFrom, dateTo, isCombined, type]);

  const handleDelete = async (id, slug) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try {
      await api.delete(`/invoicing/${slug || companySlug}/invoices/${id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      loadInvoices();
    } catch {
      toast.error(t('فشل الحذف', 'Delete failed'));
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'paid') return <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">{t('مدفوع', 'Paid')}</span>;
    if (status === 'confirmed') return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{t('مؤكد', 'Confirmed')}</span>;
    return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{t('مسودة', 'Draft')}</span>;
  };

  const renderActions = (inv) => (
    <div className="flex items-center justify-center gap-1">
      <button onClick={() => setDetailInvoice(inv)} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title={t('عرض', 'View')}><FileText size="14" /></button>
      <button onClick={() => { setEditInvoice(inv); setShowForm(true); }} className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600" title={t('تعديل', 'Edit')}><Edit3 size="14" /></button>
      <button onClick={() => handleDelete(inv.id, inv._company)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title={t('حذف', 'Delete')}><Trash2 size="14" /></button>
      {(inv.type === 'sale') && (
        <button onClick={() => generatePDF(inv, inv.items || [], lang, t, inv._company || companySlug)} className="p-1 rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600" title={t('طباعة', 'Print')}><Printer size="14" /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('من', 'From')}</label>
            <input type="date" className="input text-sm py-1.5 w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('إلى', 'To')}</label>
            <input type="date" className="input text-sm py-1.5 w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <button onClick={() => { setEditInvoice(null); setShowForm(true); }} className="btn-primary text-sm py-1.5">
          <Plus size="16" className="inline me-1" />{t('فاتورة جديدة', 'New Invoice')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('جاري التحميل...', 'Loading...')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('رقم الفاتورة', 'Invoice #')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('العميل/المورد', 'Customer')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('التاريخ', 'Date')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('عدد الأصناف', 'Items')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الإجمالي', 'Total')}</th>
                <th className="text-center py-2 px-2 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
                <th className="text-center py-2 px-2 font-medium text-gray-600">{t('إجراءات', 'Actions')}</th>
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
                  <td className="py-2 px-2 font-medium">{inv.invoice_number || '-'}</td>
                  <td className="py-2 px-2">{inv.vendor_client_name}</td>
                  <td className="py-2 px-2 text-gray-500">{inv.invoice_date}</td>
                  <td className="py-2 px-2">{inv.items?.length || inv.item_count || 0}</td>
                  <td className="py-2 px-2 font-bold">{Number(inv.grand_total || inv.total || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-center">{getStatusBadge(inv.status)}</td>
                  <td className="py-2 px-2">{renderActions(inv)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={isCombined ? 8 : 7} className="text-center py-8 text-gray-400">{t('لا توجد فواتير', 'No invoices')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <InvoiceFormModal
          show={showForm}
          onClose={() => { setShowForm(false); setEditInvoice(null); }}
          onSaved={() => { setShowForm(false); setEditInvoice(null); loadInvoices(); }}
          companySlug={companySlug}
          lang={lang}
          t={t}
          invoiceType={type}
          editInvoice={editInvoice}
        />
      )}

      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          lang={lang}
          t={t}
          companySlug={detailInvoice._company || companySlug}
        />
      )}
    </div>
  );
}

function InvoiceFormModal({ show, onClose, onSaved, companySlug, lang, t, invoiceType, editInvoice }) {
  const [itemsList, setItemsList] = useState([]);
  const [form, setForm] = useState({
    type: invoiceType || 'sale',
    vendor_client_name: '',
    customer_phone: '',
    customer_address: '',
    invoice_date: new Date().toISOString().split('T')[0],
    notes: '',
    tax: 0,
    discount: 0,
    lineItems: [{ item_id: '', item_name: '', quantity: 1, unit_price: 0, total: 0 }],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companySlug) {
      api.get(`/invoicing/${companySlug}/items`).then(({ data }) => setItemsList(data)).catch(() => {});
    }
  }, [companySlug]);

  useEffect(() => {
    if (editInvoice) {
      const items = editInvoice.items || [];
      setForm({
        type: editInvoice.type || invoiceType,
        vendor_client_name: editInvoice.vendor_client_name || '',
        customer_phone: editInvoice.customer_phone || '',
        customer_address: editInvoice.customer_address || '',
        invoice_date: editInvoice.invoice_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        notes: editInvoice.notes || '',
        tax: Number(editInvoice.tax || 0),
        discount: Number(editInvoice.discount || 0),
        lineItems: items.length > 0 ? items.map(i => ({
          item_id: i.item_id || '',
          item_name: i.item_name || '',
          quantity: Number(i.quantity || 1),
          unit_price: Number(i.unit_price || 0),
          total: Number(i.total || 0),
        })) : [{ item_id: '', item_name: '', quantity: 1, unit_price: 0, total: 0 }],
      });
    } else {
      setForm({
        type: invoiceType || 'sale',
        vendor_client_name: '',
        customer_phone: '',
        customer_address: '',
        invoice_date: new Date().toISOString().split('T')[0],
        notes: '',
        tax: 0,
        discount: 0,
        lineItems: [{ item_id: '', item_name: '', quantity: 1, unit_price: 0, total: 0 }],
      });
    }
  }, [editInvoice, invoiceType]);

  const updateLineItem = (index, field, value) => {
    const lineItems = [...form.lineItems];
    lineItems[index][field] = value;
    if (field === 'item_id') {
      const selected = itemsList.find(i => i.id === Number(value));
      if (selected) {
        lineItems[index].item_name = selected.name;
        lineItems[index].unit_price = Number(selected.default_price || 0);
      }
    }
    lineItems[index].total = Number(lineItems[index].quantity) * Number(lineItems[index].unit_price);
    setForm({ ...form, lineItems });
  };

  const addRow = () => {
    setForm({ ...form, lineItems: [...form.lineItems, { item_id: '', item_name: '', quantity: 1, unit_price: 0, total: 0 }] });
  };

  const removeRow = (index) => {
    if (form.lineItems.length <= 1) return;
    const lineItems = form.lineItems.filter((_, i) => i !== index);
    setForm({ ...form, lineItems });
  };

  const subtotal = form.lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const taxAmount = (subtotal * Number(form.tax || 0)) / 100;
  const grandTotal = subtotal + taxAmount - Number(form.discount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      type: form.type,
      customer_name: form.vendor_client_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      invoice_date: form.invoice_date,
      notes: form.notes,
      tax: Number(form.tax),
      discount: Number(form.discount),
      items: form.lineItems.filter(i => i.item_name || i.item_id).map(i => ({
        item_id: i.item_id ? Number(i.item_id) : null,
        item_name: i.item_name,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      })),
    };
    try {
      if (editInvoice) {
        await api.put(`/invoicing/${companySlug}/invoices/${editInvoice.id}`, body);
        toast.success(t('تم التحديث', 'Updated'));
      } else {
        await api.post(`/invoicing/${companySlug}/invoices`, body);
        toast.success(t('تمت الإضافة', 'Added'));
      }
      onSaved();
    } catch (err) {
      console.error('save invoice error:', err);
      toast.error(err.response?.data?.error || t('فشل في الحفظ', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {editInvoice ? t('تعديل فاتورة', 'Edit Invoice') : t('فاتورة جديدة', 'New Invoice')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size="20" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('النوع', 'Type')}</label>
              <select className="select" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} disabled={!!editInvoice}>
                <option value="sale">{t('مبيع', 'Sale')}</option>
                <option value="purchase">{t('شراء', 'Purchase')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('التاريخ', 'Date')}</label>
              <input type="date" className="input" value={form.invoice_date} onChange={(e) => setForm({...form, invoice_date: e.target.value})} required />
            </div>
          </div>
          <div>
            <label className="label">{t('اسم العميل/المورد', 'Customer/Vendor Name')}</label>
            <input className="input" value={form.vendor_client_name} onChange={(e) => setForm({...form, vendor_client_name: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('الهاتف', 'Phone')}</label>
              <input className="input" value={form.customer_phone} onChange={(e) => setForm({...form, customer_phone: e.target.value})} />
            </div>
            <div>
              <label className="label">{t('العنوان', 'Address')}</label>
              <input className="input" value={form.customer_address} onChange={(e) => setForm({...form, customer_address: e.target.value})} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">{t('الأصناف', 'Line Items')}</label>
              <button type="button" onClick={addRow} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                <Plus size="14" /> {t('إضافة صنف', 'Add Item')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-1 px-1 font-medium text-gray-600 w-5">#</th>
                    <th className="text-right py-1 px-1 font-medium text-gray-600">{t('الصنف', 'Item')}</th>
                    <th className="text-right py-1 px-1 font-medium text-gray-600 w-20">{t('الكمية', 'Qty')}</th>
                    <th className="text-right py-1 px-1 font-medium text-gray-600 w-24">{t('سعر الوحدة', 'Unit Price')}</th>
                    <th className="text-right py-1 px-1 font-medium text-gray-600 w-24">{t('الإجمالي', 'Total')}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-1 px-1 text-gray-400">{idx + 1}</td>
                      <td className="py-1 px-1">
                        <div className="flex gap-1">
                          <select className="select text-xs py-1 flex-1" value={item.item_id} onChange={(e) => updateLineItem(idx, 'item_id', e.target.value)}>
                            <option value="">{t('اختر صنف', 'Select item')}</option>
                            {itemsList.map(i => (
                              <option key={i.id} value={i.id}>{i.name} {i.code ? `(${i.code})` : ''}</option>
                            ))}
                          </select>
                          <input className="input text-xs py-1 flex-1" placeholder={t('أو اسم مخصص', 'Or custom name')} value={item.item_name} onChange={(e) => { updateLineItem(idx, 'item_name', e.target.value); if (!e.target.value) updateLineItem(idx, 'item_id', ''); }} />
                        </div>
                      </td>
                      <td className="py-1 px-1"><input type="number" className="input text-xs py-1 w-full" min="0" step="0.001" value={item.quantity} onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)} /></td>
                      <td className="py-1 px-1"><input type="number" className="input text-xs py-1 w-full" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)} /></td>
                      <td className="py-1 px-1 text-left font-medium">{Number(item.total || 0).toLocaleString()}</td>
                      <td className="py-1 px-1">
                        <button type="button" onClick={() => removeRow(idx)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"><X size="14" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 border-t pt-3">
            <div className="flex items-center gap-4 w-full max-w-xs">
              <span className="text-sm text-gray-600 flex-1">{t('المجموع', 'Subtotal')}</span>
              <span className="font-bold">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-4 w-full max-w-xs">
              <span className="text-sm text-gray-600 flex-1">{t('الضريبة %', 'Tax %')}</span>
              <input type="number" className="input text-xs py-1 w-20 text-left" min="0" max="100" step="0.01" value={form.tax} onChange={(e) => setForm({...form, tax: e.target.value})} />
              <span className="text-sm font-medium">{taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-4 w-full max-w-xs">
              <span className="text-sm text-gray-600 flex-1">{t('الخصم', 'Discount')}</span>
              <input type="number" className="input text-xs py-1 w-20 text-left" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({...form, discount: e.target.value})} />
              <span className="text-sm font-medium">{Number(form.discount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-4 w-full max-w-xs border-t pt-2">
              <span className="text-sm font-bold text-gray-800 flex-1">{t('الإجمالي النهائي', 'Grand Total')}</span>
              <span className="text-lg font-bold text-primary-700">{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label className="label">{t('ملاحظات', 'Notes')}</label>
            <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? t('جاري الحفظ...', 'Saving...') : (editInvoice ? t('تحديث', 'Update') : t('إضافة', 'Add'))}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceDetailModal({ invoice, onClose, lang, t, companySlug }) {
  if (!invoice) return null;
  const items = invoice.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
  const taxAmount = Number(invoice.tax || 0) > 0 ? (subtotal * Number(invoice.tax) / 100) : Number(invoice.tax_amount || 0);
  const grandTotal = Number(invoice.grand_total || (subtotal + taxAmount - Number(invoice.discount || 0)));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{t('فاتورة', 'Invoice')} #{invoice.invoice_number || '-'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size="20" /></button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-500">{t('التاريخ', 'Date')}: {invoice.invoice_date}</p>
            <p className="text-sm text-gray-500">
              {t('النوع', 'Type')}: {invoice.type === 'sale' ? t('مبيع', 'Sale') : t('شراء', 'Purchase')}
            </p>
          </div>
          <div>
            {invoice.status === 'paid' && <span className="px-3 py-1 rounded text-sm bg-green-100 text-green-700">{t('مدفوع', 'Paid')}</span>}
            {invoice.status === 'confirmed' && <span className="px-3 py-1 rounded text-sm bg-blue-100 text-blue-700">{t('مؤكد', 'Confirmed')}</span>}
            {(!invoice.status || invoice.status === 'draft') && <span className="px-3 py-1 rounded text-sm bg-gray-100 text-gray-600">{t('مسودة', 'Draft')}</span>}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <h3 className="font-semibold text-sm text-gray-700 mb-1">{t('معلومات العميل', 'Customer Info')}</h3>
          <p className="text-sm">{invoice.vendor_client_name}</p>
          {invoice.customer_phone && <p className="text-sm text-gray-500">{t('هاتف', 'Phone')}: {invoice.customer_phone}</p>}
          {invoice.customer_address && <p className="text-sm text-gray-500">{t('عنوان', 'Address')}: {invoice.customer_address}</p>}
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-right py-2 px-2 font-medium text-gray-600 w-8">#</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الصنف', 'Item')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الكمية', 'Qty')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('سعر الوحدة', 'Unit Price')}</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الإجمالي', 'Total')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-50">
                <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
                <td className="py-2 px-2">{item.item_name}</td>
                <td className="py-2 px-2">{Number(item.quantity).toLocaleString()}</td>
                <td className="py-2 px-2">{Number(item.unit_price).toLocaleString()}</td>
                <td className="py-2 px-2 font-medium">{Number(item.total).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="5" className="text-center py-4 text-gray-400">{t('لا توجد أصناف', 'No items')}</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-1 border-t pt-3">
          <div className="flex justify-between w-64">
            <span className="text-sm text-gray-600">{t('المجموع', 'Subtotal')}</span>
            <span className="font-medium">{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-64">
            <span className="text-sm text-gray-600">{t('الضريبة', 'Tax')}</span>
            <span className="font-medium">{Number(taxAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-64">
            <span className="text-sm text-gray-600">{t('الخصم', 'Discount')}</span>
            <span className="font-medium">-{Number(invoice.discount || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-64 border-t pt-2">
            <span className="font-bold text-gray-800">{t('الإجمالي النهائي', 'Grand Total')}</span>
            <span className="font-bold text-primary-700 text-lg">{grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-1">{t('ملاحظات', 'Notes')}</p>
            <p className="text-sm text-gray-500">{invoice.notes}</p>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {invoice.type === 'sale' && (
            <button onClick={() => generatePDF(invoice, items, lang, t, companySlug)} className="btn-primary flex-1">
              <Printer size="16" className="inline me-1" /> {t('طباعة PDF', 'Print PDF')}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">{t('إغلاق', 'Close')}</button>
        </div>
      </div>
    </div>
  );
}

function ItemsTab({ companySlug, isCombined, lang, t }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', category: '', unit: 'قطعة', default_price: '', description: '' });

  const CATEGORIES = ['مواد خام', 'مستلزمات', 'خدمات', 'أخرى'];
  const UNITS = ['قطعة', 'كجم', 'متر', 'لتر', 'حبة'];

  const loadItems = async () => {
    setLoading(true);
    try {
      if (isCombined) {
        const [p, a] = await Promise.all([
          api.get('/invoicing/printing/items').then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
          api.get('/invoicing/advertising/items').then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
        ]);
        setItems([...p, ...a]);
      } else {
        const { data } = await api.get(`/invoicing/${companySlug}/items`);
        setItems(data);
      }
    } catch {
      toast.error(t('فشل في تحميل الأصناف', 'Failed to load items'));
    }
    setLoading(false);
  };

  useEffect(() => { if (companySlug) loadItems(); }, [companySlug, isCombined]);

  const resetForm = () => {
    setForm({ name: '', code: '', category: '', unit: 'قطعة', default_price: '', description: '' });
    setEditItem(null);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      category: item.category || '',
      unit: item.unit || 'قطعة',
      default_price: String(item.default_price || ''),
      description: item.description || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const slug = isCombined ? 'printing' : companySlug;
    try {
      if (editItem) {
        await api.put(`/invoicing/${slug}/items/${editItem.id}`, form);
        toast.success(t('تم التحديث', 'Updated'));
      } else {
        await api.post(`/invoicing/${slug}/items`, form);
        toast.success(t('تمت الإضافة', 'Added'));
      }
      setShowForm(false);
      resetForm();
      loadItems();
    } catch {
      toast.error(t('فشل في الحفظ', 'Failed to save'));
    }
  };

  const handleDelete = async (id, slug) => {
    if (!confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try {
      await api.delete(`/invoicing/${slug || companySlug}/items/${id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      loadItems();
    } catch {
      toast.error(t('فشل الحذف', 'Delete failed'));
    }
  };

  const filtered = items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search size="16" className="absolute top-2.5 right-3 text-gray-400" />
          <input className="input text-sm py-1.5 pr-8 w-64" placeholder={t('بحث باسم أو كود...', 'Search by name or code...')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm py-1.5">
          <Plus size="16" className="inline me-1" />{t('صنف جديد', 'New Item')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('جاري التحميل...', 'Loading...')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الاسم', 'Name')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الكود', 'Code')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('التصنيف', 'Category')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الوحدة', 'Unit')}</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">{t('السعر الافتراضي', 'Default Price')}</th>
                <th className="text-center py-2 px-2 font-medium text-gray-600">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  {isCombined && (
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${item._company === 'printing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {item._company === 'printing' ? t('مطبعة', 'Print') : t('وكالة', 'Agency')}
                      </span>
                    </td>
                  )}
                  <td className="py-2 px-2 font-medium">{item.name}</td>
                  <td className="py-2 px-2 text-gray-500">{item.code || '-'}</td>
                  <td className="py-2 px-2">{item.category || '-'}</td>
                  <td className="py-2 px-2">{item.unit || '-'}</td>
                  <td className="py-2 px-2 font-medium">{Number(item.default_price || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600" title={t('تعديل', 'Edit')}><Edit2 size="14" /></button>
                      <button onClick={() => handleDelete(item.id, item._company)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title={t('حذف', 'Delete')}><Trash2 size="14" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isCombined ? 7 : 6} className="text-center py-8 text-gray-400">{t('لا توجد أصناف', 'No items')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{editItem ? t('تعديل صنف', 'Edit Item') : t('صنف جديد', 'New Item')}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded"><X size="20" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('الاسم', 'Name')}</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                </div>
                <div>
                  <label className="label">{t('الكود', 'Code')}</label>
                  <input className="input" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('التصنيف', 'Category')}</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                    <option value="">{t('اختر', 'Select')}</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('الوحدة', 'Unit')}</label>
                  <select className="select" value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('السعر الافتراضي', 'Default Price')}</label>
                <input type="number" className="input" min="0" step="0.01" value={form.default_price} onChange={(e) => setForm({...form, default_price: e.target.value})} />
              </div>
              <div>
                <label className="label">{t('الوصف', 'Description')}</label>
                <textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editItem ? t('تحديث', 'Update') : t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryTab({ companySlug, isCombined, lang, t }) {
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState('items');
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    try {
      if (isCombined) {
        const [p, a] = await Promise.all([
          api.get('/invoicing/printing/inventory').then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
          api.get('/invoicing/advertising/inventory').then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
        ]);
        setInventory([...p, ...a]);
      } else {
        const { data } = await api.get(`/invoicing/${companySlug}/inventory`);
        setInventory(data);
      }
    } catch {
      toast.error(t('فشل في تحميل المخزون', 'Failed to load inventory'));
    }
    setLoading(false);
  };

  const loadMovements = async () => {
    setMovementsLoading(true);
    try {
      if (isCombined) {
        const [p, a] = await Promise.all([
          api.get('/invoicing/printing/inventory/movements').then(r => r.data.map(d => ({ ...d, _company: 'printing' }))),
          api.get('/invoicing/advertising/inventory/movements').then(r => r.data.map(d => ({ ...d, _company: 'advertising' }))),
        ]);
        setMovements([...p, ...a]);
      } else {
        const { data } = await api.get(`/invoicing/${companySlug}/inventory/movements`);
        setMovements(data);
      }
    } catch {
      toast.error(t('فشل في تحميل الحركات', 'Failed to load movements'));
    }
    setMovementsLoading(false);
  };

  useEffect(() => { if (companySlug) loadInventory(); }, [companySlug, isCombined]);
  useEffect(() => { if (companySlug && subTab === 'movements') loadMovements(); }, [companySlug, subTab, isCombined]);

  const handleAdjust = async () => {
    if (!adjustItem) return;
    try {
      await api.put(`/invoicing/${companySlug}/inventory/${adjustItem.item_id || adjustItem.id}`, { quantity: Number(adjustQty) });
      toast.success(t('تم التعديل', 'Adjusted'));
      setAdjustItem(null);
      setAdjustQty(0);
      loadInventory();
    } catch {
      toast.error(t('فشل التعديل', 'Adjust failed'));
    }
  };

  const totalItems = inventory.length;
  const totalQty = inventory.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const lowStockCount = inventory.filter(i => Number(i.quantity || 0) <= Number(i.min_stock || 0)).length;
  const totalValue = inventory.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.default_price || 0)), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
          <p className="text-sm text-gray-500">{t('إجمالي الأصناف', 'Total Items')}</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold text-gray-800">{totalQty.toLocaleString()}</p>
          <p className="text-sm text-gray-500">{t('إجمالي الكمية', 'Total Qty')}</p>
        </div>
        <div className="card">
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{lowStockCount}</p>
          <p className="text-sm text-gray-500">{t('مخزون منخفض', 'Low Stock')}</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold text-gray-800">{totalValue.toLocaleString()}</p>
          <p className="text-sm text-gray-500">{t('القيمة الإجمالية', 'Total Value')}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {['items', 'movements', 'reports'].map(st => (
          <button key={st} onClick={() => setSubTab(st)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              subTab === st ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {st === 'items' ? t('الأصناف', 'Items') : st === 'movements' ? t('الحركات', 'Movements') : t('التقارير', 'Reports')}
          </button>
        ))}
      </div>

      {subTab === 'items' && (
        loading ? (
          <div className="text-center py-8 text-gray-400">{t('جاري التحميل...', 'Loading...')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الصنف', 'Item')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الكود', 'Code')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الكمية', 'Qty')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الحد الأدنى', 'Min Stock')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الموقع', 'Location')}</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv, idx) => {
                  const qty = Number(inv.quantity || 0);
                  const minStock = Number(inv.min_stock || 0);
                  const isLow = qty <= minStock && minStock > 0;
                  return (
                    <tr key={inv.id || idx} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${isLow ? 'bg-red-50' : ''}`} onClick={() => { setAdjustItem(inv); setAdjustQty(qty); }}>
                      {isCombined && (
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${inv._company === 'printing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {inv._company === 'printing' ? t('مطبعة', 'Print') : t('وكالة', 'Agency')}
                          </span>
                        </td>
                      )}
                      <td className={`py-2 px-2 font-medium ${isLow ? 'text-red-700' : ''}`}>{inv.item_name || inv.name}</td>
                      <td className={`py-2 px-2 ${isLow ? 'text-red-600' : 'text-gray-500'}`}>{inv.code || '-'}</td>
                      <td className={`py-2 px-2 font-bold ${isLow ? 'text-red-700' : ''}`}>{qty.toLocaleString()}</td>
                      <td className="py-2 px-2">{minStock.toLocaleString()}</td>
                      <td className="py-2 px-2">{inv.location || '-'}</td>
                      <td className="py-2 px-2 text-center">
                        {qty === 0 ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">{t('نفذ', 'Out')}</span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">{t('منخفض', 'Low')}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">{t('طبيعي', 'Normal')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {inventory.length === 0 && (
                  <tr><td colSpan={isCombined ? 7 : 6} className="text-center py-8 text-gray-400">{t('لا توجد بيانات مخزون', 'No inventory data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {subTab === 'movements' && (
        movementsLoading ? (
          <div className="text-center py-8 text-gray-400">{t('جاري التحميل...', 'Loading...')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {isCombined && <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الشركة', 'Company')}</th>}
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الصنف', 'Item')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('النوع', 'Type')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('الكمية', 'Qty')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('المرجع', 'Reference')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('ملاحظات', 'Notes')}</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">{t('التاريخ', 'Date')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => (
                  <tr key={m.id || idx} className="border-b border-gray-50 hover:bg-gray-50">
                    {isCombined && (
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${m._company === 'printing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {m._company === 'printing' ? t('مطبعة', 'Print') : t('وكالة', 'Agency')}
                        </span>
                      </td>
                    )}
                    <td className="py-2 px-2 font-medium">{m.item_name}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.type === 'in' ? t('وارد', 'In') : t('صادر', 'Out')}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-bold">{Number(m.quantity).toLocaleString()}</td>
                    <td className="py-2 px-2 text-gray-500">{m.reference || '-'}</td>
                    <td className="py-2 px-2 text-gray-500">{m.notes || '-'}</td>
                    <td className="py-2 px-2 text-gray-500">{m.created_at?.split('T')[0] || m.date || '-'}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={isCombined ? 7 : 6} className="text-center py-8 text-gray-400">{t('لا توجد حركات', 'No movements')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {subTab === 'reports' && (
        <InventoryReports inventory={inventory} isCombined={isCombined} lang={lang} t={t} />
      )}

      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdjustItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-3">{t('تعديل كمية', 'Adjust Quantity')}: {adjustItem.item_name || adjustItem.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setAdjustQty(prev => Math.max(0, Number(prev) - 1))} className="p-2 rounded hover:bg-gray-100"><Minus size="16" /></button>
              <input type="number" className="input text-center text-lg font-bold" min="0" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              <button type="button" onClick={() => setAdjustQty(prev => Number(prev) + 1)} className="p-2 rounded hover:bg-gray-100"><Plus size="16" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdjust} className="btn-primary flex-1">{t('حفظ', 'Save')}</button>
              <button onClick={() => setAdjustItem(null)} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryReports({ inventory, isCombined, lang, t }) {
  const categories = {};
  inventory.forEach(inv => {
    const cat = inv.category || t('أخرى', 'Other');
    const qty = Number(inv.quantity || 0);
    const val = qty * Number(inv.default_price || 0);
    if (categories[cat]) { categories[cat].qty += qty; categories[cat].val += val; }
    else { categories[cat] = { qty, val }; }
  });

  const catEntries = Object.entries(categories);
  const maxVal = Math.max(...catEntries.map(([, v]) => v.val), 1);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">{t('توزيع المخزون حسب التصنيف', 'Inventory by Category')}</h3>
      <div className="space-y-3">
        {catEntries.map(([cat, data]) => (
          <div key={cat}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{cat}</span>
              <span className="text-gray-600">{data.qty.toLocaleString()} {t('وحدة', 'units')} — {data.val.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className="bg-primary-500 h-full rounded-full transition-all" style={{ width: `${(data.val / maxVal) * 100}%` }}></div>
            </div>
          </div>
        ))}
        {catEntries.length === 0 && (
          <p className="text-center text-gray-400 text-sm">{t('لا توجد بيانات', 'No data')}</p>
        )}
      </div>
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
    catch { alert(t('فشل', 'Failed')); }
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
    } catch { alert(t('فشل', 'Failed')); }
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
            net: (pMonth.income || 0) + (pMonth.cash_in || 0) + (aMonth.income || 0) + (aMonth.cash_in || 0) - (pMonth.expenses || 0) - (pMonth.cash_out || 0) - (aMonth.expenses || 0) - (aMonth.cash_out || 0) - (pMonth.payroll || 0) - (aMonth.payroll || 0),
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

async function generatePDF(invoice, items, lang, t, companySlug) {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const isRtl = lang === 'ar';
    const pgW = 210;
    const m = 14;
    const rightX = pgW - m;
    const leftX = m;

    let company = { name: '', address: '', phone: '', logo_url: '' };
    const token = localStorage.getItem('token');
    if (companySlug) {
      try {
        const res = await fetch(`/api/settings/${companySlug}/company`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) company = await res.json();
      } catch (e) { console.error('company fetch fail', e); }
    }

    const isPrinting = companySlug !== 'advertising';
    const coName = company.name || (isPrinting ? 'المطبعة' : 'الوكالة الإعلانية');
    const coAddr = company.address || '';
    const coPhone = company.phone || '';
    const services = isPrinting
      ? 'طباعة تجارية - دعاية وإعلان - تصميم جرافيك - تغليف وتشطيب'
      : 'إعلانات - تسويق رقمي - تصميم - تنظيم فعاليات';

    let y = m + 3;

    if (company.logo_url) {
      try {
        const imgRes = await fetch(company.logo_url);
        const blob = await imgRes.blob();
        const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        const fmt = b64.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(b64, fmt, isRtl ? rightX - 22 : leftX, m, 22, 22);
      } catch (e) { console.error('logo fetch fail', e); }
    }

    const nameX = isRtl ? rightX - (company.logo_url ? 28 : 0) : leftX + (company.logo_url ? 28 : 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(coName, nameX, y, { align: isRtl ? 'right' : 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    if (services) doc.text(services, isRtl ? rightX : leftX, y + 6, { align: isRtl ? 'right' : 'left' });
    if (coAddr) doc.text(coAddr, isRtl ? rightX : leftX, y + 11, { align: isRtl ? 'right' : 'left' });
    if (coPhone) doc.text('Tel: ' + coPhone, isRtl ? rightX : leftX, y + 16, { align: isRtl ? 'right' : 'left' });

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.6);
    doc.line(leftX, y + 21, rightX, y + 21);
    y += 26;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text('INVOICE', isRtl ? rightX : leftX, y, { align: isRtl ? 'right' : 'left' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);

    const invX = isRtl ? leftX : rightX - 50;
    [['Invoice #:', invoice.invoice_number || '-'], ['Date:', invoice.invoice_date || '-']].forEach(([l, v], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(l, isRtl ? invX : rightX, y + i * 5, { align: isRtl ? 'left' : 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(v, isRtl ? invX + 25 : rightX - 30, y + i * 5, { align: isRtl ? 'left' : 'right' });
    });

    const custX = isRtl ? rightX : leftX;
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', custX, y, { align: isRtl ? 'right' : 'left' });
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.vendor_client_name || '-', isRtl ? custX - 45 : custX + 30, y, { align: isRtl ? 'right' : 'left' });
    if (invoice.customer_phone) doc.text('Phone: ' + invoice.customer_phone, isRtl ? custX : leftX, y + 5, { align: isRtl ? 'right' : 'left' });
    if (invoice.customer_address) doc.text('Address: ' + invoice.customer_address, isRtl ? custX : leftX, y + 10, { align: isRtl ? 'right' : 'left' });

    y += (invoice.customer_address ? 15 : invoice.customer_phone ? 10 : 7);

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(leftX, y, rightX, y);
    y += 5;

    const cols = [
      { header: '#', dataKey: 'idx' },
      { header: 'Description', dataKey: 'name' },
      { header: 'Qty', dataKey: 'qty' },
      { header: 'Unit Price', dataKey: 'price' },
      { header: 'Total', dataKey: 'total' },
    ];
    const body = (items || []).map((it, i) => ({
      idx: String(i + 1),
      name: it.item_name || it.name || '-',
      qty: String(Number(it.quantity)),
      price: String(Number(it.unit_price || it.rate || 0)),
      total: String(Number(it.total || (Number(it.quantity) * Number(it.unit_price)))),
    }));

    doc.autoTable({
      columns: cols, body, startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, halign: isRtl ? 'right' : 'left', lineColor: [200, 200, 200] },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: { idx: { cellWidth: 10, halign: 'center' }, qty: { halign: 'center' }, price: { halign: isRtl ? 'left' : 'right' }, total: { halign: isRtl ? 'left' : 'right', fontStyle: 'bold' } },
    });

    y = doc.lastAutoTable.finalY + 8;
    const subtotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
    const taxPct = Number(invoice.tax || 0);
    const taxAmt = taxPct > 0 ? (subtotal * taxPct / 100) : Number(invoice.tax_amount || 0);
    const disc = Number(invoice.discount || 0);
    const total = Number(invoice.grand_total || (subtotal + taxAmt - disc));

    const totals = [
      ['Subtotal:', subtotal.toLocaleString()],
      ['Tax:', taxPct > 0 ? taxPct + '% = ' + taxAmt.toLocaleString() : taxAmt.toLocaleString()],
      ['Discount:', '- ' + disc.toLocaleString()],
      ['Grand Total:', total.toLocaleString()],
    ];
    const tX = isRtl ? leftX : rightX - 100;
    totals.forEach(([l, v], i) => {
      const ly = y + i * 7;
      doc.setFont('helvetica', i === 3 ? 'bold' : 'normal');
      doc.setTextColor(i === 3 ? [59, 130, 246] : [60, 60, 60]);
      doc.setFontSize(i === 3 ? 12 : 10);
      doc.text(l, isRtl ? tX : rightX - 50, ly, { align: isRtl ? 'left' : 'right' });
      doc.text(v, isRtl ? tX + 45 : rightX, ly, { align: isRtl ? 'left' : 'right' });
    });

    y += 35;
    if (invoice.notes) {
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(leftX, y, rightX, y);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text('Notes:', isRtl ? rightX : leftX, y, { align: isRtl ? 'right' : 'left' });
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.notes, isRtl ? rightX : leftX, y + 5, { align: isRtl ? 'right' : 'left' });
    }

    const fY = 280;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(leftX, fY, rightX, fY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Thank you for your business', pgW / 2, fY + 5, { align: 'center' });
    doc.text(coName + (coPhone ? ' | ' + coPhone : '') + (coAddr ? ' | ' + coAddr : ''), pgW / 2, fY + 10, { align: 'center' });

    doc.save('invoice-' + (invoice.invoice_number || 'export') + '.pdf');
  } catch (e) { console.error('PDF error:', e); alert('PDF generation failed: ' + e.message); }
}
