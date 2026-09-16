import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { PlatformAdmin } from '../types/superadmin';
import platformApi from '../lib/platformApi';
import { queryClient } from '../lib/queryClient';

interface PlatformAuthContextType {
  admin: PlatformAdmin | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- hook vive junto a su Provider, mismo patrón que AuthContext
export const usePlatformAuth = () => {
  const context = useContext(PlatformAuthContext);
  if (context === undefined) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return context;
};

interface PlatformAuthProviderProps {
  children: ReactNode;
}

export const PlatformAuthProvider: React.FC<PlatformAuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('platform_token');
    if (token) {
      platformApi
        .get('/auth/me')
        .then((response) => setAdmin(response.data.admin))
        .catch(() => localStorage.removeItem('platform_token'))
        .finally(() => setIsLoading(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }

    const handleAuthError = () => setAdmin(null);
    window.addEventListener('platform-auth-error', handleAuthError);
    return () => window.removeEventListener('platform-auth-error', handleAuthError);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await platformApi.post('/auth/login', { email, password });
      const { admin, token } = response.data;
      localStorage.setItem('platform_token', token);
      setAdmin(admin);
    } catch {
      throw new Error('Invalid credentials');
    }
  };

  const logout = () => {
    localStorage.removeItem('platform_token');
    queryClient.clear();
    setAdmin(null);
  };

  return (
    <PlatformAuthContext.Provider value={{ admin, login, logout, isLoading }}>
      {children}
    </PlatformAuthContext.Provider>
  );
};
