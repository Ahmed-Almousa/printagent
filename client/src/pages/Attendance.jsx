import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Clock, LogIn, LogOut, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Attendance() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [records, setRecords] = useState([]);
  const [clockedIn, setClockedIn] = useState(false);
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const loadData = () => {
    api.get(`/attendance/${activeCompany}/today`).then(({ data }) => {
      setTodayData(data);
      const myRecord = data.today?.find(r => r.user_id === user?.id);
      setClockedIn(!!myRecord && !myRecord.clock_out);
    }).catch(() => {});
    api.get(`/attendance/${activeCompany}`).then(({ data }) => setRecords(data)).catch(() => {});
  };

  useEffect(() => { loadData(); }, [activeCompany]);

  const handleClockIn = async () => {
    try {
      let lat = null, lng = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
          lat = pos.coords.latitude; lng = pos.coords.longitude;
        } catch {}
      }
      await api.post(`/attendance/${activeCompany}/clock-in`, { lat, lng });
      toast.success(t('تم تسجيل الدخول', 'Clocked in'));
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل', 'Failed'));
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post(`/attendance/${activeCompany}/clock-out`);
      toast.success(t('تم تسجيل الخروج', 'Clocked out'));
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('فشل', 'Failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('الحضور والانصراف', 'Attendance')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('تسجيل الحضور والانصراف', 'Clock in/out')}</p>
        </div>
      </div>

      <div className="card text-center">
        <Clock size="48" className="mx-auto mb-3 text-primary-600" />
        <h2 className="text-lg font-semibold mb-2">{t('تسجيل اليوم', "Today's Record")}</h2>
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={handleClockIn} disabled={clockedIn} className="btn-success px-6 py-3 text-base">
            <LogIn size="20" /> {t('تسجيل دخول', 'Clock In')}
          </button>
          <button onClick={handleClockOut} disabled={!clockedIn} className="btn-danger px-6 py-3 text-base">
            <LogOut size="20" /> {t('تسجيل خروج', 'Clock Out')}
          </button>
        </div>
        {navigator.geolocation && (
          <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
            <MapPin size="12" /> {t('سيتم تسجيل الموقع تلقائياً', 'Location will be recorded automatically')}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('حضور اليوم', "Today's Attendance")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right py-3 px-2 font-medium text-gray-600">{t('الموظف', 'Employee')}</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600">{t('الدخول', 'Clock In')}</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600">{t('الخروج', 'Clock Out')}</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {(todayData?.today || []).map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-2 font-medium">{r.user_name}</td>
                  <td className="py-3 px-2 text-center">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString() : '-'}</td>
                  <td className="py-3 px-2 text-center">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : '-'}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`badge ${r.clock_out ? 'bg-green-100 text-green-700' : r.clock_in ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.clock_out ? t('مغادر', 'Left') : r.clock_in ? t('موجود', 'Present') : t('غائب', 'Absent')}
                    </span>
                  </td>
                </tr>
              ))}
              {(todayData?.today || []).length === 0 && (
                <tr><td colSpan="4" className="text-center py-6 text-gray-400">{t('لا توجد سجلات اليوم', 'No records today')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
