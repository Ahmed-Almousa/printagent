import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Printer, Megaphone, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('مرحباً بك!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || (err.message === 'Network Error' ? 'الخادم قيد الإقلاع... حاول مرة أخرى بعد قليل' : 'خطأ في تسجيل الدخول');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center"><Printer size="24" /></div>
            <div className="text-2xl text-gray-300">+</div>
            <div className="w-12 h-12 rounded-xl bg-accent-600 text-white flex items-center justify-center"><Megaphone size="24" /></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">نظام إدارة المطبعة والوكالة الإعلانية</h1>
          <p className="text-gray-500 text-sm">ERP-Lite لإدارة الأعمال والإنتاج والموارد البشرية</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">اسم المستخدم</label>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              <LogIn size={18} />
            </button>
          </form>
          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-medium mb-1">حسابات تجريبية:</p>
            <p>المشرف: admin / admin123</p>
            <p>مدير المطبعة: mgr_print / admin123</p>
            <p>مدير الوكالة: mgr_adv / admin123</p>
            <p>موظف مطبعة: emp1 / admin123</p>
            <p>موظف وكالة: emp2 / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
