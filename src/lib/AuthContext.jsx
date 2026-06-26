/**
 * AuthContext — مبني على PIN login محلي (بدون Base44 auth)
 * الـ session يُحفظ في sessionStore بدون PIN
 */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { getSession, clearSession } from '@/lib/sessionStore';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoadingAuth, setIsLoadingAuth]                   = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [appPublicSettings, setAppPublicSettings]           = useState(null);
  const [authError]                                         = useState(null);

  useEffect(() => {
    loadPublicSettings();
  }, []);

  const loadPublicSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings').select('*').limit(1);
      setAppPublicSettings(data?.[0] || {});
    } catch {
      setAppPublicSettings({});
    } finally {
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = () => {
    clearSession();
    window.location.replace('/login');
  };

  const navigateToLogin = () => {
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{
      isLoadingAuth,
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
