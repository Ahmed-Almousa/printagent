import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => {
          setUser(data.user);
          setCompany(data.company);
        })
        .catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setCompany(data.company);
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setCompany(null);
  }, []);

  const updateUserPermissions = useCallback((permissionsStr) => {
    setUser(prev => prev ? { ...prev, permissions: permissionsStr } : prev);
  }, []);

  const hasPermission = useCallback((permKey) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (!user.permissions) return false;
    const perms = user.permissions.split(',').map(p => p.trim());
    return perms.includes(permKey);
  }, [user]);

  const hasAnyPermission = useCallback((...permKeys) => {
    return permKeys.some(key => hasPermission(key));
  }, [hasPermission]);

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout, hasPermission, hasAnyPermission, updateUserPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
