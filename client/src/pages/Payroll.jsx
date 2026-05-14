import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { DollarSign, Calculator, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Payroll() {
  const { activeCompany, lang } = useCompany();
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const t = (ar, en) => lang === 'ar' ? ar : en;

  const load = () => {
    api.get(`/payroll/${activeCompany}?month=${month}&year=${year}`).then(({ data }) => setPayrolls(data)).catch(() => {});
  };

  useEffect(() => { load(); }, [activeCompany, month, year]);

  const handleCalculate = async () => {
    try {
      const { data } = await api.post(`/payroll/${activeCompany}/calculate`, { month, year });
      toast.success(t('تم حساب الرواتب', 'Payroll calculated'));
      load();
    } catch (err) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const handlePay = async (id) => {
    try {
      await api.put(`/payroll/${activeCompany}/${id}/pay`);
      toast.success(t('تم الدفع', 'Paid'));
      load();
    } catch (err) { toast.error(t('فشل', 'Failed')); }
  };

  const canManage = user?.role !== 'employee';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('الرواتب', 'Payroll')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('إدارة الرواتب الشهرية', 'Monthly salary management')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select w-32" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{t(`شهر ${m}`, `Month ${m}`)}</option>
            ))}
          </select>
          <select className="select w-24" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {canManage && (
            <button onClick={handleCalculate} className="btn-primary"><Calculator size="16" /> {t('احتساب', 'Calculate')}</button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right py-3 px-3 font-medium text-gray-600">{t('الموظف', 'Employee')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('الراتب الأساسي', 'Base')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('السلف', 'Advances')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('غرامات التأخير', 'Late Fees')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('صافي الراتب', 'Net')}</th>
                <th className="text-center py-3 px-3 font-medium text-gray-600">{t('الحالة', 'Status')}</th>
                {canManage && <th className="text-center py-3 px-3 font-medium text-gray-600">{t('إجراء', 'Action')}</th>}
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium">{p.user_name}</td>
                  <td className="py-3 px-3 text-center">{p.base_salary?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center text-red-600">{p.advances_deducted?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center text-orange-600">{p.late_penalties?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center font-bold text-green-600">{p.net_salary?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`badge ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.status === 'paid' ? t('مدفوع', 'Paid') : t('قيد الانتظار', 'Pending')}
                    </span>
                  </td>
                  {canManage && (
                    <td className="py-3 px-3 text-center">
                      {p.status !== 'paid' && (
                        <button onClick={() => handlePay(p.id)} className="btn-success text-xs px-3 py-1">
                          <DollarSign size="14" /> {t('دفع', 'Pay')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {payrolls.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <DollarSign size="48" className="mx-auto mb-3 opacity-30" />
            <p>{t('لا توجد رواتب محتسبة لهذا الشهر', 'No payroll for this month')}</p>
            {canManage && <button onClick={handleCalculate} className="btn-primary mt-3"><Calculator size="16" /> {t('احتساب الرواتب', 'Calculate Payroll')}</button>}
          </div>
        )}
      </div>

      <div className="card bg-gradient-to-r from-primary-50 to-blue-50">
        <h3 className="font-semibold text-gray-800 mb-2">{t('صيغة احتساب الراتب', 'Salary Calculation')}</h3>
        <p className="text-sm text-gray-600">{t('صافي الراتب = الراتب الأساسي - السلف المخصومة - غرامات التأخير', 'Net Salary = Base Salary - Advances Deducted - Late Penalties')}</p>
      </div>
    </div>
  );
}
