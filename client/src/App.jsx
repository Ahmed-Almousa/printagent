import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useCompany } from './contexts/CompanyContext';
import { canAccessPage } from './utils/permissions';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectsAndTasks from './pages/ProjectsAndTasks';
import TaskDetail from './pages/TaskDetail';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Requests from './pages/Requests';
import Finances from './pages/Finances';
import Settings from './pages/Settings';
import Archive from './pages/Archive';
import Permissions from './pages/Permissions';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function ProtectedPage({ page, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!canAccessPage(user, page)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  const { dir } = useCompany();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen" dir={dir}><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div dir={dir}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<ProtectedPage page="dashboard"><Dashboard /></ProtectedPage>} />
          <Route path="projects-tasks" element={<ProtectedPage page="projects"><ProjectsAndTasks /></ProtectedPage>} />
          <Route path="tasks/:companySlug/:taskId" element={<ProtectedPage page="tasks"><TaskDetail /></ProtectedPage>} />
          <Route path="employees" element={<ProtectedPage page="employees"><Employees /></ProtectedPage>} />
          <Route path="attendance" element={<ProtectedPage page="attendance"><Attendance /></ProtectedPage>} />
          <Route path="requests" element={<ProtectedPage page="requests"><Requests /></ProtectedPage>} />
          <Route path="finances" element={<ProtectedPage page="finances"><Finances /></ProtectedPage>} />
          <Route path="settings" element={<ProtectedPage page="settings"><Settings /></ProtectedPage>} />
          <Route path="archive" element={<ProtectedPage page="archive"><Archive /></ProtectedPage>} />
          <Route path="permissions" element={<ProtectedPage page="permissions"><Permissions /></ProtectedPage>} />
        </Route>
      </Routes>
    </div>
  );
}