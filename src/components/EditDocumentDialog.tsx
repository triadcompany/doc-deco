import { useState, useEffect } from 'react';
import { PDFDocument, DocVisibility } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save } from 'lucide-react';

interface EditDocumentDialogProps {
  doc: PDFDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { title: string; author: string; date: string; tags: string[]; visibility: DocVisibility }) => Promise<void>;
}

export function EditDocumentDialog({ doc, open, onOpenChange, onSave }: EditDocumentDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [date, setDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState<DocVisibility>('personal');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setAuthor(doc.author);
      setDate(doc.date);
      setTagsInput(doc.tags.join(', '));
      setVisibility(doc.visibility || 'personal');
    }
  }, [doc]);

  const handleSave = async () => {
    if (!doc || !title.trim()) return;
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      await onSave(doc.id, { title: title.trim(), author: author.trim(), date, tags, visibility });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Título <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Autor</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tags</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Separe por vírgula"
            />
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Visibilidade</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as DocVisibility)} className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                <RadioGroupItem value="global" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Disponível para todos (Global)</p>
                  <p className="text-xs text-muted-foreground">Todos os usuários podem ver</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                <RadioGroupItem value="personal" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Pessoal (Somente eu)</p>
                  <p className="text-xs text-muted-foreground">Apenas você pode ver</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !title.trim()} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
