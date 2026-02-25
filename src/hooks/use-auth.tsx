import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    });

    // Try to get session with a 10s timeout
    withTimeout(supabase.auth.getSession(), 10000, 'getSession')
      .then(({ data: { session } }) => {
        if (mounted) {
          setSession(session);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao obter sessão:', err);
        if (mounted) setLoading(false);
      });

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
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      }),
      15000,
      'Criar conta'
    );
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      15000,
      'Login'
    );
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await withTimeout(
      supabase.auth.signOut(),
      10000,
      'Logout'
    );
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
