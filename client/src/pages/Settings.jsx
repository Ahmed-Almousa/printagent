import { useState, useEffect, useRef } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Building2, Moon, Sun, Coins, Shield, Type, Plus, Edit3, Trash2, Save, Eye, EyeOff,
  Globe, MapPin, Phone, User, Mail, KeyRound, RefreshCw, DollarSign, CheckCircle, X, Loader2,
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'company', icon: Building2, labelAr: 'الشركة', labelEn: 'Company' },
  { key: 'appearance', icon: Sun, labelAr: 'المظهر', labelEn: 'Appearance' },
  { key: 'currency', icon: Coins, labelAr: 'العملة', labelEn: 'Currency' },
  { key: 'profile', icon: Shield, labelAr: 'الملف الشخصي', labelEn: 'Profile' },
  { key: 'request-types', icon: Type, labelAr: 'أنواع الطلبات', labelEn: 'Request Types' },
];

export default function Settings() {
  const { activeCompany, lang, theme, toggleTheme, switchLang } = useCompany();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(false);
  const t = (ar, en) => lang === 'ar' ? ar : en;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('الإعدادات', 'Settings')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('إدارة إعدادات التطبيق', 'Manage application settings')}</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1.5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size="16" />
            {t(tab.labelAr, tab.labelEn)}
          </button>
        ))}
      </div>

      {activeTab === 'company' && <CompanySettings activeCompany={activeCompany} lang={lang} />}
      {activeTab === 'appearance' && <AppearanceSettings lang={lang} theme={theme} toggleTheme={toggleTheme} switchLang={switchLang} />}
      {activeTab === 'currency' && <CurrencySettings activeCompany={activeCompany} lang={lang} />}
      {activeTab === 'profile' && <ProfileSettings lang={lang} user={user} />}
      {activeTab === 'request-types' && <RequestTypesSettings activeCompany={activeCompany} lang={lang} />}
    </div>
  );
}

function CompanySettings({ activeCompany, lang }) {
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [form, setForm] = useState({
    name: '', phone: '', address: '', owner_name: '', tax_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    api.get(`/settings/${activeCompany}/company`).then(({ data }) => {
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        address: data.address || '',
        owner_name: data.owner_name || '',
        tax_number: data.tax_number || ''
      });
      setLogoUrl(data.logo_url || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeCompany]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/settings/${activeCompany}/company`, form);
      toast.success(t('تم الحفظ', 'Saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

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
      setLogoUrl(data.logo_url);
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
      setLogoUrl(null);
      toast.success(t('تم حذف الشعار', 'Logo removed'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل الحذف', 'Delete failed'));
    }
  };

  if (loading) return <div className="card"><div className="flex items-center justify-center py-12"><Loader2 size="24" className="animate-spin text-gray-400" /></div></div>;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 size="18" className="text-primary-600" />
        {t('بيانات الشركة', 'Company Information')}
      </h2>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center gap-4">
        <div className="relative group">
          <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-300 bg-white">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 size="32" className="text-gray-400" />
            )}
          </div>
          <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            onClick={() => logoInputRef.current?.click()}>
            {uploading ? (
              <Loader2 size="18" className="animate-spin text-white" />
            ) : (
              <Camera size="18" className="text-white" />
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">{t('شعار الشركة', 'Company Logo')}</p>
          <p className="text-xs text-gray-500">{t('اضغط على الصورة لتغيير الشعار', 'Click the image to change the logo')}</p>
        </div>
        {logoUrl && (
          <button onClick={handleLogoRemove} className="btn-secondary text-sm flex items-center gap-1">
            <Trash2 size="14" /> {t('حذف', 'Remove')}
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-xl">
        <div>
          <label className="label">{t('اسم الشركة', 'Company Name')}</label>
          <input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1"><Phone size="14" /> {t('رقم الهاتف', 'Phone')}</label>
            <input className="input ltr:text-left" dir="ltr" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><MapPin size="14" /> {t('العنوان', 'Address')}</label>
            <input className="input" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1"><User size="14" /> {t('اسم المالك', 'Owner Name')}</label>
            <input className="input" value={form.owner_name} onChange={(e) => setForm({...form, owner_name: e.target.value})} />
          </div>
          <div>
            <label className="label flex items-center gap-1">{t('الرقم الضريبي', 'Tax Number')}</label>
            <input className="input ltr:text-left" dir="ltr" value={form.tax_number} onChange={(e) => setForm({...form, tax_number: e.target.value})} />
          </div>
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Save size="16" /> {t('حفظ التغييرات', 'Save Changes')}
        </button>
      </form>
    </div>
  );
}

function AppearanceSettings({ lang, theme, toggleTheme, switchLang }) {
  const t = (ar, en) => lang === 'ar' ? ar : en;

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sun size="18" className="text-orange-500" />
          {t('السمة', 'Theme')}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Sun size="28" className={`mx-auto mb-2 ${theme === 'light' ? 'text-primary-600' : 'text-gray-400'}`} />
            <p className={`font-medium text-sm ${theme === 'light' ? 'text-primary-700' : 'text-gray-600'}`}>
              {t('فاتح', 'Light')}
            </p>
            {theme === 'light' && <CheckCircle size="16" className="mx-auto mt-1 text-primary-600" />}
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
              theme === 'dark'
                ? 'border-primary-500 bg-gray-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Moon size="28" className={`mx-auto mb-2 ${theme === 'dark' ? 'text-primary-400' : 'text-gray-400'}`} />
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-600'}`}>
              {t('داكن', 'Dark')}
            </p>
            {theme === 'dark' && <CheckCircle size="16" className="mx-auto mt-1 text-primary-400" />}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe size="18" className="text-blue-500" />
          {t('اللغة والاتجاه', 'Language & Direction')}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => switchLang('ar')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
              lang === 'ar'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className={`text-2xl font-bold mb-1 ${lang === 'ar' ? 'text-primary-700' : 'text-gray-400'}`}>ع</p>
            <p className={`font-medium text-sm ${lang === 'ar' ? 'text-primary-700' : 'text-gray-600'}`}>
              {t('العربية', 'Arabic')}
            </p>
            <p className="text-xs text-gray-400">{t('من اليمين لليسار', 'RTL')}</p>
            {lang === 'ar' && <CheckCircle size="16" className="mx-auto mt-1 text-primary-600" />}
          </button>
          <button
            onClick={() => switchLang('en')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
              lang === 'en'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className={`text-2xl font-bold mb-1 ${lang === 'en' ? 'text-primary-700' : 'text-gray-400'}`}>A</p>
            <p className={`font-medium text-sm ${lang === 'en' ? 'text-primary-700' : 'text-gray-600'}`}>
              {t('الإنجليزية', 'English')}
            </p>
            <p className="text-xs text-gray-400">{t('من اليسار لليمين', 'LTR')}</p>
            {lang === 'en' && <CheckCircle size="16" className="mx-auto mt-1 text-primary-600" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrencySettings({ activeCompany, lang }) {
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [currencies, setCurrencies] = useState([]);
  const [company, setCompany] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [rate, setRate] = useState('1.0');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/settings/${activeCompany}/currencies`),
      api.get(`/settings/${activeCompany}/company`)
    ]).then(([curRes, comRes]) => {
      setCurrencies(curRes.data);
      setCompany(comRes.data);
      setSelectedCurrency(comRes.data.currency || 'SAR');
      setRate(String(comRes.data.currency_rate || 1.0));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeCompany]);

  const handleSaveCurrency = async () => {
    try {
      await api.put(`/settings/${activeCompany}/company`, { currency: selectedCurrency, currency_rate: parseFloat(rate) || 1 });
      setCompany(prev => ({ ...prev, currency: selectedCurrency, currency_rate: parseFloat(rate) || 1 }));
      toast.success(t('تم حفظ العملة', 'Currency saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const handleSyncRate = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
      const data = await res.json();
      if (data.rates && data.rates[selectedCurrency]) {
        const syncedRate = data.rates[selectedCurrency];
        setRate(String(syncedRate));
        await api.put(`/settings/${activeCompany}/company`, { currency: selectedCurrency, currency_rate: syncedRate });
        toast.success(t('تمت المزامنة', 'Synced'));
      } else {
        toast.error(t('لا يمكن جلب سعر الصرف', 'Cannot fetch rate'));
      }
    } catch {
      toast.error(t('فشل الاتصال بخادم الأسعار', 'Failed to connect to rate server'));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="card"><div className="flex items-center justify-center py-12"><Loader2 size="24" className="animate-spin text-gray-400" /></div></div>;

  const selectedCurr = currencies.find(c => c.code === selectedCurrency);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Coins size="18" className="text-green-500" />
          {t('العملة الافتراضية', 'Default Currency')}
        </h2>
        <div className="max-w-xl space-y-4">
          <div>
            <label className="label">{t('اختر العملة', 'Select Currency')}</label>
            <select className="select" value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)}>
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code} - {t(c.nameAr, c.nameEn)}</option>
              ))}
            </select>
          </div>
          {selectedCurr && (
            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
              <span className="text-2xl">{selectedCurr.symbol}</span>
              <div>
                <p className="font-medium">{selectedCurr.code}</p>
                <p className="text-xs text-gray-500">{t(selectedCurr.nameAr, selectedCurr.nameEn)}</p>
              </div>
            </div>
          )}
          <button onClick={handleSaveCurrency} className="btn-primary flex items-center gap-2">
            <Save size="16" /> {t('حفظ العملة', 'Save Currency')}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign size="18" className="text-blue-500" />
          {t('سعر الصرف', 'Exchange Rate')}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('سعر صرف العملة مقابل الدولار الأمريكي', 'Exchange rate against USD')}
        </p>
        <div className="max-w-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label">{t('1 USD =', '1 USD =')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  className="input"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  dir="ltr"
                />
                <span className="text-lg font-bold text-gray-600">{selectedCurr?.symbol || selectedCurrency}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveCurrency} className="btn-primary flex items-center gap-2">
              <Save size="16" /> {t('حفظ السعر', 'Save Rate')}
            </button>
            <button onClick={handleSyncRate} disabled={syncing} className="btn-secondary flex items-center gap-2">
              <RefreshCw size="16" className={syncing ? 'animate-spin' : ''} />
              {syncing ? t('جارٍ المزامنة...', 'Syncing...') : t('مزامنة حية', 'Live Sync')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({ lang, user }) {
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '', new_password: '', confirm_password: ''
  });
  const [showPw, setShowPw] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/auth/profile', profile);
      toast.success(t('تم تحديث الملف', 'Profile updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return toast.error(t('كلمة المرور غير متطابقة', 'Passwords do not match'));
    }
    if (passwordForm.new_password.length < 6) {
      return toast.error(t('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'Password must be at least 6 characters'));
    }
    try {
      await api.put('/auth/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast.success(t('تم تغيير كلمة المرور', 'Password changed'));
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User size="18" className="text-primary-600" />
          {t('المعلومات الشخصية', 'Personal Information')}
        </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-xl">
          <div>
            <label className="label">{t('الاسم الكامل', 'Full Name')}</label>
            <input className="input" value={profile.full_name} onChange={(e) => setProfile({...profile, full_name: e.target.value})} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1"><Mail size="14" /> {t('البريد الإلكتروني', 'Email')}</label>
              <input type="email" className="input ltr:text-left" dir="ltr" value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Phone size="14" /> {t('رقم الهاتف', 'Phone')}</label>
              <input className="input ltr:text-left" dir="ltr" value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn-primary flex items-center gap-2">
            <Save size="16" /> {t('حفظ', 'Save')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <KeyRound size="18" className="text-red-500" />
          {t('تغيير كلمة المرور', 'Change Password')}
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
          <div>
            <label className="label">{t('كلمة المرور الحالية', 'Current Password')}</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input" value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size="16" /> : <Eye size="16" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('كلمة المرور الجديدة', 'New Password')}</label>
              <input type="password" className="input" value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} required />
            </div>
            <div>
              <label className="label">{t('تأكيد كلمة المرور', 'Confirm Password')}</label>
              <input type="password" className="input" value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})} required />
            </div>
          </div>
          <button type="submit" className="btn-danger flex items-center gap-2">
            <KeyRound size="16" /> {t('تغيير كلمة المرور', 'Change Password')}
          </button>
        </form>
      </div>
    </div>
  );
}

function RequestTypesSettings({ activeCompany, lang }) {
  const t = (ar, en) => lang === 'ar' ? ar : en;
  const [types, setTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');

  const loadTypes = () => {
    api.get(`/settings/${activeCompany}/request-types`).then(({ data }) => setTypes(data)).catch(() => {});
  };

  useEffect(() => { loadTypes(); }, [activeCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (editing) {
        await api.put(`/settings/${activeCompany}/request-types/${editing.id}`, { name });
        toast.success(t('تم التحديث', 'Updated'));
      } else {
        await api.post(`/settings/${activeCompany}/request-types`, { name });
        toast.success(t('تمت الإضافة', 'Added'));
      }
      setShowModal(false);
      setEditing(null);
      setName('');
      loadTypes();
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await api.delete(`/settings/${activeCompany}/request-types/${id}`);
      toast.success(t('تم الحذف', 'Deleted'));
      loadTypes();
    } catch (err) {
      toast.error(err.response?.data?.error || t('حدث خطأ', 'Error'));
    }
  };

  const openEdit = (type) => {
    setEditing(type);
    setName(type.name);
    setShowModal(true);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Type size="18" className="text-primary-600" />
          {t('أنواع الطلبات', 'Request Types')}
        </h2>
        <button onClick={() => { setEditing(null); setName(''); setShowModal(true); }} className="btn-primary">
          <Plus size="16" /> {t('إضافة', 'Add')}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {types.map(type => (
          <div key={type.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-all">
            <span className="text-sm font-medium">{type.name}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(type)} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><Edit3 size="14" /></button>
              <button onClick={() => handleDelete(type.id)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size="14" /></button>
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400">{t('لا توجد أنواع طلبات', 'No request types')}</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowModal(false); setEditing(null); setName(''); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {editing ? t('تعديل النوع', 'Edit Type') : t('إضافة نوع جديد', 'Add New Type')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('الاسم', 'Name')}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">{editing ? t('تحديث', 'Update') : t('إضافة', 'Add')}</button>
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); setName(''); }} className="btn-secondary">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}