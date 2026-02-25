import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
        // After signup, try to auto-login immediately
        try {
          await signIn(email, password);
        } catch (loginErr: any) {
          const loginMsg = loginErr?.message || '';
          if (loginMsg.includes('Email not confirmed') || loginMsg.includes('email_not_confirmed')) {
            toast({
              title: 'Conta criada!',
              description: 'Verifique seu email para confirmar sua conta antes de fazer login.',
            });
          } else {
            toast({
              title: 'Conta criada!',
              description: 'Sua conta foi criada com sucesso! Faça login.',
            });
            setIsLogin(true);
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Algo deu errado';
      const isTimeout = msg.includes('tempo limite');
      const isEmailNotConfirmed = msg.includes('Email not confirmed') || msg.includes('email_not_confirmed');
      toast({
        title: isEmailNotConfirmed ? 'Email não confirmado' : 'Erro',
        description: isTimeout
          ? 'O servidor está demorando para responder. Tente novamente em alguns segundos.'
          : isEmailNotConfirmed
          ? 'Verifique seu email e clique no link de confirmação antes de fazer login.'
          : msg,
        variant: isEmailNotConfirmed ? 'default' : 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow-amber mb-4">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">DocVault</CardTitle>
          <CardDescription>
            {isLogin ? 'Faça login para acessar seus documentos' : 'Crie sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full glow-amber" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Não tem conta? Criar conta' : 'Já tem conta? Fazer login'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
