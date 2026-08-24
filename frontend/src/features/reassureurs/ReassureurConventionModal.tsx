import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { conventionsApi } from '../../api/master-data.api';

interface Props {
  reassureurId: string;
  onClose: () => void;
}

interface FileEntry {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

export default function ReassureurConventionModal({ reassureurId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dateSignature, setDateSignature] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [notes, setNotes] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const remaining = 100 - files.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(incoming).slice(0, remaining);
    setFiles((prev) => [
      ...prev,
      ...toAdd.map((f) => ({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, file: f, status: 'pending' as const })),
    ]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    if (files.length === 0) { setGlobalError('Veuillez sélectionner au moins un fichier.'); return; }
    setSubmitting(true);
    for (const entry of files) {
      if (entry.status === 'done') continue;
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'uploading' } : f));
      try {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('partnerType', 'REASSUREUR');
        formData.append('partnerId', reassureurId);
        if (dateSignature) formData.append('dateSignature', dateSignature);
        if (dateEffet) formData.append('dateEffet', dateEffet);
        if (notes.trim()) formData.append('notes', notes.trim());
        await conventionsApi.attach(formData);
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'done' } : f));
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Erreur lors de l'envoi.";
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'error', errorMsg: msg } : f));
      }
    }
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId, 'conventions'] });
    queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
    const updated = files.filter((f) => f.status !== 'done');
    if (updated.every((f) => f.status === 'done') || files.every((f) => f.status === 'done')) onClose();
  };

  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-border bg-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-display text-lg font-semibold text-foreground">Nouvelle convention</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {globalError && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-[13px] text-destructive">{globalError}</div>}

          <div>
            <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
              Fichiers <span className="text-destructive">*</span>
            </label>
            <div
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <Upload size={24} className="text-muted-foreground/70" />
              <span className="text-[13px] text-muted-foreground">Cliquez ou glissez-déposez vos fichiers</span>
              <span className="text-[11px] text-muted-foreground/70">PDF, Word, Excel, images — tous formats acceptés</span>
              <input ref={inputRef} type="file" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {files.map((entry) => (
                <div key={entry.id} className={`flex items-center justify-between p-2.5 rounded-xl border text-[12px] ${
                  entry.status === 'done' ? 'border-success/25 bg-success/10' :
                  entry.status === 'error' ? 'border-destructive/25 bg-destructive/10' :
                  entry.status === 'uploading' ? 'border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.1)]' : 'border-border'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.status === 'done' && <CheckCircle2 size={14} className="text-success shrink-0" />}
                    {entry.status === 'error' && <AlertCircle size={14} className="text-destructive shrink-0" />}
                    {entry.status === 'uploading' && <div className="w-3.5 h-3.5 border-2 border-[hsl(var(--chart-4)/0.35)] border-t-[hsl(var(--chart-4))] rounded-full animate-spin shrink-0" />}
                    {entry.status === 'pending' && <FileText size={14} className="text-muted-foreground/70 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{entry.file.name}</p>
                      {entry.status === 'error' && <p className="text-destructive text-[11px]">{entry.errorMsg}</p>}
                    </div>
                  </div>
                  {entry.status !== 'uploading' && entry.status !== 'done' && (
                    <button type="button" onClick={() => setFiles((p) => p.filter((f) => f.id !== entry.id))} className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0 ml-2">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Date de signature</label>
              <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Date d'effet</label>
              <input type="date" value={dateEffet} onChange={(e) => setDateEffet(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
            {files.length > 1 && <p className="mt-1 text-[11px] text-muted-foreground/70">Ces métadonnées s'appliquent à tous les fichiers.</p>}
          </div>
        </form>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-border shrink-0">
          <div className="text-[12px] text-muted-foreground/70">
            {submitting && `${doneCount} / ${files.length} envoyé${doneCount > 1 ? 's' : ''}...`}
            {!submitting && files.length > 0 && `${files.length} fichier${files.length > 1 ? 's' : ''} sélectionné${files.length > 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-xl transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSubmit as any}
              disabled={submitting || files.length === 0}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}