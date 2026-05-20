import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, FolderOpen, ListChecks, Users, Clock,
  CalendarCheck, HandCoins, Building2, LogIn, LogOut, XCircle,
  Camera, Trash2
} from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const STAGE_COLORS = {
  draft: 'bg-gray-400', design_review: 'bg-blue-400', pending_approval: 'bg-yellow-400',
  production: 'bg-purple-400', finishing: 'bg-orange-400', ready_pickup: 'bg-green-400',
  delivered: 'bg-green-600', brief: 'bg-gray-400', concept_design: 'bg-blue-400',
  client_feedback: 'bg-yellow-400', launch: 'bg-purple-400', reporting: 'bg-green-400',
  cancelled: 'bg-red-500', archived: 'bg-orange-500',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);
  const [now, setNow] = useState(new Date());
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef(null);
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const monthNames = lang === 'ar' ? MONTHS_AR : MONTHS;
  const isPrinting = activeCompany === 'printing';

  useEffect(() => {
    const year = new Date().getFullYear();
    api.get(`/auth/companies/${activeCompany}/stats?year=${year}`)
      .then(({ data }) => setStats(data))
      .catch(() => {});
    api.get(`/settings/${activeCompany}/company`)
      .then(({ data }) => setCompany(data))
      .catch(() => {});
  }, [activeCompany]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`/api/settings/${activeCompany}/company/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCompany(prev => ({ ...prev, logo_url: data.logo_url }));
      toast.success(t('تم رفع الشعار', 'Logo uploaded'));
    } catch (err) {
      toast.error(err.message || t('فشل الرفع', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      await api.delete(`/settings/${activeCompany}/company/logo`);
      setCompany(prev => ({ ...prev, logo_url: null }));
      toast.success(t('تم حذف الشعار', 'Logo removed'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل الحذف', 'Delete failed'));
    }
  };

  const formatDate = (d) => {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', opts);
  };
  const formatTime = (d) => d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const statCards = stats ? [
    { icon: TrendingUp, label: t('إجمالي الإيرادات', 'Total Revenue'), value: `${stats.totalRevenue?.toLocaleString()}`, color: 'text-green-600', bg: 'bg-green-50', to: '/finances' },
    { icon: FolderOpen, label: t('المشاريع النشطة', 'Active Projects'), value: stats.activeProjects, color: 'text-blue-600', bg: 'bg-blue-50', to: '/projects-tasks' },
    { icon: ListChecks, label: t('المهام النشطة', 'Active Tasks'), value: stats.activeTasks, color: 'text-purple-600', bg: 'bg-purple-50', to: '/projects-tasks' },
    { icon: Users, label: t('الموظفون', 'Employees'), value: stats.employees, color: 'text-orange-600', bg: 'bg-orange-50', to: '/employees' },
    { icon: Clock, label: t('الحضور اليوم', "Today's Attendance"), value: stats.todayAttendance, color: 'text-cyan-600', bg: 'bg-cyan-50', to: '/attendance' },
    { icon: CalendarCheck, label: t('طلبات الإجازة', 'Pending Leaves'), value: stats.pendingLeaves, color: 'text-yellow-600', bg: 'bg-yellow-50', to: '/requests' },
    { icon: HandCoins, label: t('طلبات السلف', 'Pending Advances'), value: stats.pendingAdvances, color: 'text-red-600', bg: 'bg-red-50', to: '/requests' },
  ] : [];

  const maxMonthly = stats?.monthlyTasks?.length ? Math.max(...stats.monthlyTasks.map(m => m.count), 1) : 1;

  const checkedIn = stats?.attendanceData?.filter(a => a.clock_in && !a.clock_out) || [];
  const checkedOut = stats?.attendanceData?.filter(a => a.clock_in && a.clock_out) || [];
  const absent = stats?.attendanceData?.filter(a => !a.clock_in) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {t('لوحة التحكم', 'Dashboard')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isPrinting ? t('مرحباً بك في لوحة تحكم المطبعة', 'Welcome to Printing Dashboard') : t('مرحباً بك في لوحة تحكم الوكالة الإعلانية', 'Welcome to Agency Dashboard')}
          </p>
        </div>
        <div className={`card px-5 py-3 flex items-center gap-4 ${isPrinting ? 'border-blue-200' : 'border-green-200'}`}>
          <div className="relative group">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2 ${isPrinting ? 'border-blue-300' : 'border-green-300'}`}>
              {company?.logo_url ? (
                <img src={company.logo_url} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 size="28" className={isPrinting ? 'text-blue-500' : 'text-green-500'} />
              )}
            </div>
            <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 cursor-pointer"
              onClick={() => logoInputRef.current?.click()}>
              {uploading ? (
                <span className="text-white text-xs animate-pulse">{t('رفع...', '...')}</span>
              ) : (
                <Camera size="16" className="text-white" />
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-800">{company?.name || (isPrinting ? t('المطبعة', 'Printing Press') : t('الوكالة الإعلانية', 'Advertising Agency'))}</p>
            <p className="text-xs text-gray-500" dir="ltr">{formatDate(now)}</p>
            <p className="text-sm font-semibold text-gray-700" dir="ltr">{formatTime(now)}</p>
          </div>
          {company?.logo_url && (
            <button onClick={handleLogoRemove} className="p-1 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title={t('حذف الشعار', 'Remove logo')}>
              <Trash2 size="14" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card card-hover cursor-pointer" onClick={() => navigate(card.to)}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                <card.icon size="20" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {t('المهام الشهرية', 'Monthly Tasks')} — {new Date().getFullYear()}
          </h2>
          <div className="space-y-2">
            {monthNames.map((name, i) => {
              const monthNum = i + 1;
              const found = stats?.monthlyTasks?.find(m => m.month === monthNum);
              const count = found?.count || 0;
              const pct = (count / maxMonthly) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8 text-left">{name}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isPrinting ? 'bg-blue-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {t('الحضور اليوم', "Today's Attendance")}
          </h2>
          {stats?.attendanceData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <LogIn size="16" className="text-green-600" />
                  <span className="text-sm text-gray-700">{t('مسجل دخول', 'Clocked In')}</span>
                </div>
                <span className="text-lg font-bold text-green-700">{checkedIn.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <LogOut size="16" className="text-blue-600" />
                  <span className="text-sm text-gray-700">{t('سجل خروج', 'Clocked Out')}</span>
                </div>
                <span className="text-lg font-bold text-blue-700">{checkedOut.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle size="16" className="text-red-600" />
                  <span className="text-sm text-gray-700">{t('لم يسجل', 'Absent')}</span>
                </div>
                <span className="text-lg font-bold text-red-700">{absent.length}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('التفاصيل', 'Details')}</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {stats.attendanceData.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-700">{a.full_name}</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        a.clock_in && a.clock_out ? 'bg-blue-100 text-blue-700' :
                        a.clock_in ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.clock_in && a.clock_out ? t('خروج', 'Out') :
                         a.clock_in ? t('داخل', 'In') : t('غائب', 'Absent')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">{t('لا توجد بيانات', 'No data')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {isPrinting ? t('مراحل الإنتاج - المطبعة', 'Printing Stages') : t('مراحل الإنتاج - الوكالة', 'Agency Stages')}
          </h2>
          {stats?.stageDistribution?.length > 0 ? (
            <div className="space-y-2">
              {stats.stageDistribution.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-32 truncate">{s.stage}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STAGE_COLORS[s.stage] || 'bg-gray-400'}`}
                      style={{ width: `${Math.min((s.count / Math.max(...stats.stageDistribution.map(x => x.count), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">{t('لا توجد مهام بعد', 'No tasks yet')}</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {isPrinting ? t('سير عمل المطبعة', 'Printing Workflow') : t('سير عمل الوكالة', 'Agency Workflow')}
          </h2>
          <div className="space-y-2">
            {(isPrinting ? [
              { stage: t('مسودة', 'Draft'), key: 'draft', color: 'bg-gray-400' },
              { stage: t('تصميم وتدقيق', 'Design & Review'), key: 'design_review', color: 'bg-blue-400' },
              { stage: t('موافقة المدير', 'Manager Approval'), key: 'pending_approval', color: 'bg-yellow-400' },
              { stage: t('إنتاج', 'Production'), key: 'production', color: 'bg-purple-400' },
              { stage: t('تشطيب', 'Finishing'), key: 'finishing', color: 'bg-orange-400' },
              { stage: t('جاهز للاستلام', 'Ready for Pickup'), key: 'ready_pickup', color: 'bg-green-400' },
              { stage: t('تم التسليم', 'Delivered'), key: 'delivered', color: 'bg-green-600' },
              { stage: t('ملغي', 'Cancelled'), key: 'cancelled', color: 'bg-red-500' },
              { stage: t('مؤرشف', 'Archived'), key: 'archived', color: 'bg-orange-500' },
            ] : [
              { stage: t('موجز العميل', 'Client Brief'), key: 'brief', color: 'bg-gray-400' },
              { stage: t('مفهوم وتصميم', 'Concept & Design'), key: 'concept_design', color: 'bg-blue-400' },
              { stage: t('ملاحظات العميل', 'Client Feedback'), key: 'client_feedback', color: 'bg-yellow-400' },
              { stage: t('إطلاق/نشر', 'Launch/Publish'), key: 'launch', color: 'bg-purple-400' },
              { stage: t('تقارير', 'Reporting'), key: 'reporting', color: 'bg-green-400' },
              { stage: t('تم التسليم', 'Delivered'), key: 'delivered', color: 'bg-green-600' },
              { stage: t('ملغي', 'Cancelled'), key: 'cancelled', color: 'bg-red-500' },
              { stage: t('مؤرشف', 'Archived'), key: 'archived', color: 'bg-orange-500' },
            ]).map((s, i, arr) => {
              const count = stats?.stageDistribution?.find(d => d.stage === s.key)?.count || 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  <span className="text-sm text-gray-700">{s.stage}</span>
                  {count > 0 && <span className="badge text-[10px] bg-gray-200 text-gray-600">{count}</span>}
                  {i < arr.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}