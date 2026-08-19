import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getStoredToken, setStoredToken } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOGIN_SERVICE_URL = import.meta.env.VITE_LOGIN_SERVICE_URL as string;

// Helper: race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: tempo limite de ${ms / 1000}s excedido. Verifique sua conexão.`)), ms)
    ),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const res = await fetch(`${LOGIN_SERVICE_URL}/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.authenticated) {
      setUser({ id: data.userId, email: data.email });
    } else {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    withTimeout(refreshSession(), 10000, 'getSession')
      .catch((err) => console.error('Erro ao obter sessão:', err))
      .finally(() => { if (mounted) setLoading(false); });

    // Safety net: if nothing resolves in 12s, stop loading
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading((prev) => {
          if (prev) console.warn('Auth timeout - desbloqueando tela');
          return false;
        });
      }
    }, 12000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [refreshSession]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const res = await withTimeout(
      fetch(`${LOGIN_SERVICE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      }),
      15000,
      'Cadastro'
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Falha no cadastro');
    }
  };

  const signIn = async (email: string, password: string) => {
    const res = await withTimeout(
      fetch(`${LOGIN_SERVICE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      }),
      15000,
      'Login'
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Falha no login');
    }
    const data = await res.json();
    if (!data.token || !data.userId) {
      throw new Error('Resposta de login inválida (sem token) — o login-service está com uma versão desatualizada?');
    }
    setStoredToken(data.token);
    setUser({ id: data.userId, email: data.email });
  };

  const signOut = async () => {
    await withTimeout(
      fetch(`${LOGIN_SERVICE_URL}/logout`, { method: 'POST', credentials: 'include' }),
      10000,
      'Logout'
    ).catch(() => { /* stateless JWT — clearing local state below is what matters */ });
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
