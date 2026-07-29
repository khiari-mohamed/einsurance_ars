import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';
import type { Sinistre } from '../../types/sinistre.types';

interface Props { sinistre: Sinistre }

export default function SinistreSAP({ sinistre }: Props) {
  const queryClient = useQueryClient();
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustData, setAdjustData] = useState({ sap: sinistre.sap ?? 0, note: '' });

  const adjustMutation = useMutation({
    mutationFn: () => sinistresApi.adjustSap(sinistre.id, adjustData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre', sinistre.id] });
      setShowAdjustForm(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600 font-medium">Réserves (générales)</div>
          <div className="text-2xl font-bold text-orange-900">{formatCurrency(sinistre.reserves ?? 0)}</div>
          <p className="text-xs text-orange-700 mt-1">Modifiable via l'onglet Fiche.</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">SAP au 31/12</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(sinistre.sap ?? 0)}</div>
          <p className="text-xs text-blue-700 mt-1">Valeur année-comptable, ajustée ci-dessous avec traçabilité.</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Part Réassureurs</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(sinistre.partReassureurs ?? 0)}</div>
        </div>
      </div>

      {!showAdjustForm ? (
        <button
          onClick={() => setShowAdjustForm(true)}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Ajuster le SAP
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Ajustement du SAP</h4>
            <button type="button" onClick={() => setShowAdjustForm(false)} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau montant SAP</label>
            <input
              type="number" step="0.001" required
              value={adjustData.sap}
              onChange={(e) => setAdjustData({ ...adjustData, sap: parseFloat(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Valeur absolue — remplace le SAP actuel ({formatCurrency(sinistre.sap ?? 0)}).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <textarea
              value={adjustData.note}
              onChange={(e) => setAdjustData({ ...adjustData, note: e.target.value })}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdjustForm(false)} className="flex-1 border rounded-lg px-4 py-2 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={adjustMutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {adjustMutation.isPending ? 'Ajustement...' : 'Confirmer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}