import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { reassureursApi } from '../../api/master-data.api';

interface Props {
  reassureurId: string;
  freeFields?: Record<string, any>;
  onClose: () => void;
}

interface FieldRow { key: string; value: string; }

export default function ReassureurFreeFieldsModal({ reassureurId, freeFields, onClose }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<FieldRow[]>(() => {
    const entries = Object.entries(freeFields || {});
    return entries.length === 0 ? [{ key: '', value: '' }] : entries.map(([k, v]) => ({ key: k, value: String(v ?? '') }));
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (next: Record<string, string>) => reassureursApi.update(reassureurId, { freeFields: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.message || "Erreur lors de l'enregistrement."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const filled = rows.filter((r) => r.key.trim() !== '');
    const seen = new Set<string>();
    for (const r of filled) {
      const k = r.key.trim();
      if (seen.has(k)) { setError(`La clé "${k}" est en double.`); return; }
      seen.add(k);
    }
    const next: Record<string, string> = {};
    filled.forEach((r) => { next[r.key.trim()] = r.value; });
    mutation.mutate(next);
  };

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-border bg-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Champs libres</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-[13px] text-destructive">{error}</div>}

          <p className="text-[12px] text-muted-foreground mb-4">Champs configurables librement (CDC §5.7, onglet 5). Une clé vide sera ignorée.</p>

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="flex items-start gap-2">
                <input type="text" placeholder="Nom du champ" value={row.key}
                  onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <input type="text" placeholder="Valeur" value={row.value}
                  onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                  className="p-2 rounded-xl hover:bg-destructive/10 text-destructive shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setRows((p) => [...p, { key: '', value: '' }])}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80">
            <Plus size={14} /> Ajouter un champ
          </button>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-xl transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}