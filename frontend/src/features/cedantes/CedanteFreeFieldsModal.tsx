import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';

interface CedanteFreeFieldsModalProps {
  cedanteId: string;
  freeFields?: Record<string, any>;
  onClose: () => void;
}

interface FieldRow {
  key: string;
  value: string;
}

export default function CedanteFreeFieldsModal({ cedanteId, freeFields, onClose }: CedanteFreeFieldsModalProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<FieldRow[]>(() => {
    const entries = Object.entries(freeFields || {});
    if (entries.length === 0) return [{ key: '', value: '' }];
    return entries.map(([key, value]) => ({ key, value: String(value ?? '') }));
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (nextFreeFields: Record<string, string>) =>
      cedantesApi.update(cedanteId, { freeFields: nextFreeFields }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement des champs libres.");
    },
  });

  const addRow = () => setRows((prev) => [...prev, { key: '', value: '' }]);

  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const updateRow = (index: number, field: 'key' | 'value', value: string) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const filled = rows.filter((r) => r.key.trim() !== '');

    const seen = new Set<string>();
    for (const r of filled) {
      const k = r.key.trim();
      if (seen.has(k)) {
        setError(`La clé "${k}" est en double.`);
        return;
      }
      seen.add(k);
    }

    const nextFreeFields: Record<string, string> = {};
    filled.forEach((r) => {
      nextFreeFields[r.key.trim()] = r.value;
    });

    mutation.mutate(nextFreeFields);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">Champs libres</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {error}
            </div>
          )}

          <p className="text-[12px] text-gray-500 mb-4">
            Champs configurables librement (CDC §5.7, onglet 5). Une clé vide sera ignorée à l'enregistrement.
          </p>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="flex items-start gap-2">
                <input
                  type="text"
                  placeholder="Nom du champ"
                  value={row.key}
                  onChange={(e) => updateRow(index, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Valeur"
                  value={row.value}
                  onChange={(e) => updateRow(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500 shrink-0"
                  title="Supprimer ce champ"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />
            Ajouter un champ
          </button>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}