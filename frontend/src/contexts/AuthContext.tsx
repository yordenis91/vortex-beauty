import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole, AuthResponse } from '../types';
import api from '../lib/api';
import { queryClient } from '../lib/queryClient';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- hook vive junto a su Provider a propósito, usado en ~20 archivos
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { saveTenantSlug } from '../lib/tenantSlug';
import { clearImpersonation, consumeImpersonationToken, endSession, lastRefreshWasOffline, loadUserSnapshot, refreshSession, rememberSession, saveUserSnapshot, setAccessToken } from '../lib/session';
import { clearPersistedCache } from '../lib/persistCache';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Al abrir la app se intenta recuperar la sesión: primero la de impersonación (soporte,
    // solo en esta pestaña) y, si no hay, la cookie de renovación.
    const restore = async () => {
      const impersonation = consumeImpersonationToken();
      if (impersonation) {
        setAccessToken(impersonation);
        try {
          const response = await api.get<{ user: User }>('/auth/me');
          if (!cancelled) setUser(response.data.user);
        } catch {
          clearImpersonation();
          setAccessToken(null);
        }
      } else {
        const session = await refreshSession();
        if (!cancelled && session) setUser(session.user);
        // Sin red pero con sesión de antes: se abre con los datos guardados (solo lectura) en vez de pedir el login.
        else if (!cancelled && lastRefreshWasOffline()) {
          const saved = loadUserSnapshot();
          if (saved) setUser(saved);
        }
      }
      if (!cancelled) setIsLoading(false);
    };
    void restore();

    // Listen for auth errors
    const handleAuthError = () => {
      setUser(null);
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      cancelled = true;
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', { email, password, tenantSlug });
      const { user, token } = response.data;
      // Otra cuenta en el mismo dispositivo: no se le muestran los datos guardados de la anterior.
      const previous = loadUserSnapshot();
      if (previous && previous.id !== user.id) {
        queryClient.clear();
        void clearPersistedCache();
      }
      saveUserSnapshot(user);
      setAccessToken(token);
      rememberSession();
      saveTenantSlug(tenantSlug);
      setUser(user);
    } catch {
      throw new Error('Invalid credentials');
    }
  };

  const logout = () => {
    void endSession();
    queryClient.clear();
    void clearPersistedCache();
    setUser(null);
  };

  const value = {
    user,
    role: user?.role ?? null,
    setUser,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};