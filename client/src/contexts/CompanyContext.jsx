import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [activeCompany, setActiveCompany] = useState('printing');
  const [dir, setDir] = useState('rtl');
  const [lang, setLang] = useState('ar');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const switchCompany = (slug) => {
    setActiveCompany(slug);
  };

  const switchLang = useCallback((l) => {
    setLang(l);
    setDir(l === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <CompanyContext.Provider value={{ activeCompany, setActiveCompany: switchCompany, dir, lang, switchLang, theme, toggleTheme }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
