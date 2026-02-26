import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ReadingGoal, useReadingGoals } from '@/hooks/use-reading-goals';
import { PDFDocument } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, BookOpen, FileText, Edit2, Check, TrendingUp, Calendar, Flame, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface MetaTabProps {
  documents: PDFDocument[];
  completedThisMonth: number;
  goal: ReadingGoal | null;
  upsertGoal: (monthlyDocs: number, dailyPages: number) => Promise<void>;
  resetMonthlyProgress: () => Promise<void>;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function MetaTab({ documents, completedThisMonth, goal, upsertGoal, resetMonthlyProgress }: MetaTabProps) {
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [editingDaily, setEditingDaily] = useState(false);
  const [monthlyValue, setMonthlyValue] = useState(goal?.monthly_docs_goal ?? 5);
  const [dailyValue, setDailyValue] = useState(goal?.daily_pages_goal ?? 30);

  useEffect(() => {
    if (goal) {
      setMonthlyValue(goal.monthly_docs_goal);
      setDailyValue(goal.daily_pages_goal);
    }
  }, [goal]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const monthlyGoal = goal?.monthly_docs_goal ?? 5;
  const dailyGoal = goal?.daily_pages_goal ?? 30;
  const monthlyProgress = Math.min((completedThisMonth / monthlyGoal) * 100, 100);

  const saveMonthly = async () => {
    await upsertGoal(monthlyValue, dailyValue);
    setEditingMonthly(false);
    toast.success('Meta mensal atualizada!');
  };

  const saveDaily = async () => {
    await upsertGoal(monthlyValue, dailyValue);
    setEditingDaily(false);
    toast.success('Meta diária atualizada!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Metas de Leitura</h2>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[currentMonth]} {now.getFullYear()} · Dia {dayOfMonth} de {daysInMonth}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Goal Card */}
        <Card className="glass border-border/50 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary/60 to-primary" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Meta Mensal
              </CardTitle>
              <div className="flex items-center gap-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Resetar progresso mensal">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resetar progresso mensal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso vai zerar o contador de documentos concluídos neste mês. Os documentos voltarão a aparecer em "Acessados Recentemente".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => { await resetMonthlyProgress(); toast.success('Progresso mensal resetado!'); }}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingMonthly(!editingMonthly)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingMonthly ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={monthlyValue}
                  onChange={(e) => setMonthlyValue(Number(e.target.value))}
                  className="w-24 h-9"
                />
                <span className="text-sm text-muted-foreground">documentos/mês</span>
                <Button size="sm" onClick={saveMonthly}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-primary">{completedThisMonth}</span>
                  <span className="text-lg text-muted-foreground mb-1">/ {monthlyGoal}</span>
                  <Badge variant="secondary" className="ml-auto mb-1">
                    <FileText className="w-3 h-3 mr-1" />
                    documentos
                  </Badge>
                </div>
                <Progress value={monthlyProgress} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {monthlyGoal - completedThisMonth > 0
                    ? `Faltam ${monthlyGoal - completedThisMonth} documentos para atingir a meta`
                    : '🎉 Meta atingida! Parabéns!'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily Goal Card */}
        <Card className="glass border-border/50 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent-foreground/40 to-accent-foreground" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-accent-foreground" />
                Meta Diária
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditingDaily(!editingDaily)}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingDaily ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={dailyValue}
                  onChange={(e) => setDailyValue(Number(e.target.value))}
                  className="w-24 h-9"
                />
                <span className="text-sm text-muted-foreground">páginas/dia</span>
                <Button size="sm" onClick={saveDaily}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-accent-foreground">{dailyGoal}</span>
                  <Badge variant="secondary" className="ml-auto mb-1">
                    <BookOpen className="w-3 h-3 mr-1" />
                    páginas/dia
                  </Badge>
                </div>
                <div className="glass rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-medium">Projeção mensal:</span>
                    <span className="text-muted-foreground">{dailyGoal * daysInMonth} páginas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium">Restante este mês:</span>
                    <span className="text-muted-foreground">
                      {dailyGoal * (daysInMonth - dayOfMonth)} páginas
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{documents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de documentos</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{completedThisMonth}</p>
          <p className="text-xs text-muted-foreground mt-1">Lidos este mês</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {Math.round(monthlyProgress)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Progresso da meta</p>
        </div>
      </div>
    </div>
  );
}
