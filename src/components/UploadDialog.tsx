import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Loader2, Files, File } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseFileName, formatFileSize } from '@/lib/mock-data';
import { toast } from 'sonner';

type UploadMode = 'batch' | 'single';
type Visibility = 'global' | 'personal' | 'group';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, meta: { title: string; author: string; date: string; tags: string[] }) => Promise<void>;
  onComplete: () => void;
  authorsList?: string[];
  translatorsList?: string[];
}

export function UploadDialog({ open, onOpenChange, onUpload, onComplete, authorsList = [], translatorsList = [] }: UploadDialogProps) {
  const [mode, setMode] = useState<UploadMode>('batch');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Shared fields
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [translator, setTranslator] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('personal');

  // Single mode fields
  const [singleTitle, setSingleTitle] = useState('');
  const [singleDate, setSingleDate] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (mode === 'single') {
      setFiles(acceptedFiles.slice(0, 1));
      if (acceptedFiles.length > 0) {
        const { title, date } = parseFileName(acceptedFiles[0].name);
        setSingleTitle(singleTitle || title);
        setSingleDate(singleDate || date);
      }
    } else {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    }
  }, [mode, singleTitle, singleDate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: mode === 'batch',
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFiles([]);
    setAuthor('');
    setDescription('');
    setTagsInput('');
    setTranslator('');
    setVisibility('personal');
    setSingleTitle('');
    setSingleDate('');
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setUploading(true);

    try {
      for (const file of files) {
        const { title, date } = parseFileName(file.name);
        await onUpload(file, {
          title: mode === 'single' ? singleTitle || title : title,
          author,
          date: mode === 'single' ? singleDate || date : date,
          tags,
        });
      }
      toast.success(files.length > 1 ? 'Upload concluído!' : 'Documento salvo!');
      onComplete();
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao enviar documento(s)');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const switchMode = (newMode: UploadMode) => {
    setMode(newMode);
    setFiles([]);
    setSingleTitle('');
    setSingleDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-6">
            <p className="text-sm text-muted-foreground">Adicione PDFs à sua biblioteca</p>

            {/* Mode tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => switchMode('batch')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  mode === 'batch'
                    ? 'bg-secondary text-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <Files className="w-4 h-4" />
                Upload em Lote
              </button>
              <button
                type="button"
                onClick={() => switchMode('single')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  mode === 'single'
                    ? 'bg-secondary text-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <File className="w-4 h-4" />
                Documento Único
              </button>
            </div>

            {/* Dropzone */}
            <div>
              <Label className="text-sm font-medium">
                {mode === 'single' ? 'Arquivo PDF' : 'Arquivos PDF'} <span className="text-destructive">*</span>
              </Label>
              <div
                {...getRootProps()}
                className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-primary bg-accent/50'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {mode === 'single'
                    ? 'Clique para selecionar um arquivo PDF'
                    : 'Clique para selecionar múltiplos arquivos PDF'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Tamanho máximo por arquivo: 50MB</p>
              </div>
            </div>

            {/* Selected files list */}
            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-processing info (batch mode) */}
            {mode === 'batch' && (
              <div className="rounded-lg bg-secondary/50 p-4 space-y-1">
                <p className="text-sm font-medium">Processamento Automático:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Título será extraído do nome do arquivo (sem números)</li>
                  <li>Data será extraída do nome do arquivo (se houver) no formato dd/MM/yyyy</li>
                </ul>
              </div>
            )}

            {/* Single mode: Title field */}
            {mode === 'single' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  placeholder="Título do documento"
                />
              </div>
            )}

            {/* Author */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Autor</Label>
              {authorsList.length > 0 ? (
                <Select value={author} onValueChange={setAuthor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite um autor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {authorsList.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Selecione ou digite um autor..."
                />
              )}
              {mode === 'batch' && (
                <p className="text-xs text-muted-foreground">Será aplicado a todos os documentos do lote</p>
              )}
            </div>

            {/* Single mode: Date field */}
            {mode === 'single' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Data do Documento</Label>
                <Input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve resumo do conteúdo..."
                rows={4}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tags</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex: pregação, estudo bíblico, evangelismo (separe por vírgula)"
              />
              <p className="text-xs text-muted-foreground">Separe as tags por vírgula</p>
            </div>

            {/* Translator */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tradução</Label>
              {translatorsList.length > 0 ? (
                <Select value={translator} onValueChange={setTranslator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite um tradutor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {translatorsList.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={translator}
                  onChange={(e) => setTranslator(e.target.value)}
                  placeholder="Selecione ou digite um tradutor..."
                />
              )}
              <p className="text-xs text-muted-foreground">Nome do tradutor ou versão da tradução</p>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Visibilidade do Documento</Label>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as Visibility)} className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <RadioGroupItem value="global" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Disponível para todos (Global)</p>
                    <p className="text-xs text-muted-foreground">Todos os usuários podem ver este documento</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <RadioGroupItem value="personal" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Pessoal (Somente eu)</p>
                    <p className="text-xs text-muted-foreground">Apenas você pode ver este documento</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border/50 p-3 opacity-50 cursor-not-allowed">
                  <RadioGroupItem value="group" disabled className="mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Compartilhar com grupos</p>
                    <p className="text-xs text-muted-foreground">Funcionalidade disponível em breve</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading || (mode === 'single' && !singleTitle)}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {mode === 'single' ? 'Salvar Documento' : 'Salvar Documentos'}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={uploading}>
                Cancelar
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
