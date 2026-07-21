import React, { createContext, useState, useContext, useEffect } from 'react';
import { getSession, clearSession } from '@/lib/sessionStore';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ⚡ لا نوقف التطبيق بسبب app_settings - نبدأ فوراً
  const [isLoadingPublicSettings] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({});
  const [authError] = useState(null);

  useEffect(() => {
    // نجلب الإعدادات في الخلفية بدون توقف
    supabase.from('app_settings').select('*').limit(1)
      .then(({ data }) => { if (data?.[0]) setAppPublicSettings(data[0]); })
      .catch(() => {});
  }, []);

  const logout = () => {
    clearSession();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => window.location.replace('/login'));
  };
  const navigateToLogin = () => { window.location.replace('/login'); };

  return (
    <AuthContext.Provider value={{
      isLoadingAuth: false,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
