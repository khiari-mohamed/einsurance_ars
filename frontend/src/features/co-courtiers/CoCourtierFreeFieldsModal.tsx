import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props {
  freeFields: Record<string, any>;
  onSave: (freeFields: Record<string, any>) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export default function CoCourtierFreeFieldsModal({ freeFields, onSave, onClose, isSaving }: Props) {
  const [rows, setRows] = useState<{ key: string; value: string }[]>(
    Object.entries(freeFields || {}).map(([key, value]) => ({ key, value: String(value) }))
  );

  const addRow = () => setRows((prev) => [...prev, { key: '', value: '' }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: 'key' | 'value', value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.key.trim()) result[r.key.trim()] = r.value;
    });
    onSave(result);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[16px] font-semibold text-gray-900">Champs libres</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {rows.length === 0 && (
              <p className="text-[13px] text-gray-400 text-center py-4">Aucun champ. Cliquez sur "Ajouter un champ".</p>
            )}
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  placeholder="Libellé"
                  value={row.key}
                  onChange={(e) => updateRow(idx, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  placeholder="Valeur"
                  value={row.value}
                  onChange={(e) => updateRow(idx, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="button" onClick={() => removeRow(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addRow} className="flex items-center gap-1.5 mt-3 text-[12px] font-medium text-blue-600 hover:text-blue-700">
            <Plus size={14} />
            Ajouter un champ
          </button>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}