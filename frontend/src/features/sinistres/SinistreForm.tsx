import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import affairesApi from '../../api/affaires.api';
import { AffaireStatut } from '../../types/affaire.types';
import type { CreateSinistreDto } from '../../types/sinistre.types';

export default function SinistreForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateSinistreDto>({
    affaireId: '',
    numerPolice: '',
    periodeCouverture: '',
    dateSurvenance: new Date().toISOString().split('T')[0],
    reglementExerciceN: undefined,
    cumulReglementAnterieurs: undefined,
    reserves: undefined,
    partReassureurs: undefined,
    appelAuComptant: false,
    description: '',
    cause: '',
    lieu: '',
  });

  // Only placed affaires can carry a claim — matches the real backend guard
  // in SinistresService.create().
  const { data: affaires } = useQuery({
    queryKey: ['affaires-placees'],
    queryFn: () => affairesApi.getAll({ statut: AffaireStatut.PLACEMENT_REALISE, limit: 200 }),
  });

  const selectedAffaire = affaires?.data?.data.find((a) => a.id === formData.affaireId);

  const createMutation = useMutation({
    mutationFn: (data: CreateSinistreDto) => sinistresApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      navigate('/sinistres');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.affaireId) { alert('Veuillez sélectionner une affaire'); return; }
    createMutation.mutate(formData);
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/sinistres')} className="text-gray-600 hover:text-gray-800">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Nouveau Sinistre</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Affaire (placée) *</label>
            <select
              required
              value={formData.affaireId}
              onChange={(e) => setFormData({ ...formData, affaireId: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Sélectionner une affaire</option>
              {affaires?.data?.data.map((a) => (
                <option key={a.id} value={a.id}>{a.numero} — {a.cedante.raisonSociale}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">N° Police Cédante</label>
            <input
              type="text"
              value={formData.numerPolice}
              onChange={(e) => setFormData({ ...formData, numerPolice: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Survenance *</label>
            <input
              required
              type="date"
              value={formData.dateSurvenance}
              onChange={(e) => setFormData({ ...formData, dateSurvenance: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période de Couverture</label>
            <input
              type="text"
              placeholder="ex. 01/01/2026 - 31/12/2026"
              value={formData.periodeCouverture}
              onChange={(e) => setFormData({ ...formData, periodeCouverture: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Règlement Exercice N</label>
            <input
              type="number" step="0.001"
              value={formData.reglementExerciceN ?? ''}
              onChange={(e) => setFormData({ ...formData, reglementExerciceN: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cumul Règlements Antérieurs</label>
            <input
              type="number" step="0.001"
              value={formData.cumulReglementAnterieurs ?? ''}
              onChange={(e) => setFormData({ ...formData, cumulReglementAnterieurs: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Réserves</label>
            <input
              type="number" step="0.001"
              value={formData.reserves ?? ''}
              onChange={(e) => setFormData({ ...formData, reserves: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Part Réassureurs</label>
            <input
              type="number" step="0.001"
              value={formData.partReassureurs ?? ''}
              onChange={(e) => setFormData({ ...formData, partReassureurs: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cause</label>
            <input
              type="text"
              value={formData.cause}
              onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lieu</label>
            <input
              type="text"
              value={formData.lieu}
              onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.appelAuComptant}
            onChange={(e) => setFormData({ ...formData, appelAuComptant: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">Appel au comptant anticipé</span>
        </label>

        {selectedAffaire && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Réassureurs sur cette affaire ({selectedAffaire.reassureurs?.length ?? 0})
            </p>
            <p className="text-xs text-blue-700 mb-2">
              La répartition par réassureur sera créée automatiquement lors de la déclaration aux réassureurs, une fois le sinistre validé.
            </p>
            <ul className="text-sm text-blue-900 space-y-1">
              {selectedAffaire.reassureurs?.map((r) => (
                <li key={r.reassureurId}>{r.reassureur.raisonSociale} — {r.partPct}%</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate('/sinistres')} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Création...' : 'Créer Sinistre'}
          </button>
        </div>
      </form>
    </div>
  );
}