import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';
import { Sinistre } from '../../types/sinistre.types';

interface Props {
  sinistre: Sinistre;
}

export default function SinistreSAP({ sinistre }: Props) {
  const queryClient = useQueryClient();
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustData, setAdjustData] = useState({
    type: 'AUGMENTATION',
    montant: 0,
    raison: '',
  });

  const adjustMutation = useMutation({
    mutationFn: (data: any) => sinistresApi.adjustSAP({ ...data, sinistreId: sinistre.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre', sinistre.id] });
      setShowAdjustForm(false);
      setAdjustData({ type: 'AUGMENTATION', montant: 0, raison: '' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustMutation.mutate(adjustData);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Réserve Initiale</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(sinistre.sapInitial)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Réserve Actuelle</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(sinistre.sapActuel)}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600 font-medium">Variation</div>
          <div className="text-2xl font-bold text-orange-900">
            {formatCurrency(sinistre.sapActuel - sinistre.sapInitial)}
          </div>
        </div>
      </div>

      {sinistre.dateDerniereRevisionSAP && (
        <div className="text-sm text-gray-600">
          Dernière révision: {new Date(sinistre.dateDerniereRevisionSAP).toLocaleString('fr-FR')}
        </div>
      )}

      {!showAdjustForm ? (
        <button
          onClick={() => setShowAdjustForm(true)}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Ajuster la Réserve
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Ajustement de Réserve</h4>
            <button
              type="button"
              onClick={() => setShowAdjustForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type d'ajustement</label>
            <select
              value={adjustData.type}
              onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="AUGMENTATION">Augmentation</option>
              <option value="REDUCTION">Réduction</option>
              <option value="CLOTURE">Clôture</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant</label>
            <input
              type="number"
              step="0.01"
              required
              value={adjustData.montant}
              onChange={(e) => setAdjustData({ ...adjustData, montant: parseFloat(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Raison</label>
            <textarea
              required
              value={adjustData.raison}
              onChange={(e) => setAdjustData({ ...adjustData, raison: e.target.value })}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAdjustForm(false)}
              className="flex-1 border rounded-lg px-4 py-2 hover:bg-gray-50"
            >
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
