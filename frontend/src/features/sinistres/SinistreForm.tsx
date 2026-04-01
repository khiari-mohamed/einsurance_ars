import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft} from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import { affairesApi } from '../../api/affaires.api';
import { CreateSinistreDto } from '../../types/sinistre.types';

export default function SinistreForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateSinistreDto>({
    referenceCedante: '',
    affaireId: '',
    cedanteId: '',
    dateSurvenance: new Date(),
    dateDeclarationCedante: new Date(),
    montantTotal: 0,
    montantCedantePart: 0,
    description: '',
    cause: '',
    lieu: '',
    cedantePaymentVerified: false,
    expertiseRequise: false,
    participations: [],
  });

  const { data: affaires } = useQuery({
    queryKey: ['affaires'],
    queryFn: async () => {
      const { data } = await affairesApi.getAll();
      return data;
    },
  });

  const selectedAffaire = affaires?.find((a: any) => a.id === formData.affaireId);

  useEffect(() => {
    if (selectedAffaire) {
      setFormData(prev => ({
        ...prev,
        cedanteId: selectedAffaire.cedanteId,
        participations: selectedAffaire.reinsurers?.map((r: any) => ({
          reassureurId: r.reassureurId,
          partPourcentage: r.share,
          montantPart: 0,
        })) || [],
      }));
    }
  }, [selectedAffaire]);

  useEffect(() => {
    const montantReassurance = formData.montantTotal - formData.montantCedantePart;
    setFormData(prev => ({
      ...prev,
      participations: prev.participations.map(p => ({
        ...p,
        montantPart: (montantReassurance * p.partPourcentage) / 100,
      })),
    }));
  }, [formData.montantTotal, formData.montantCedantePart]);

  const createMutation = useMutation({
    mutationFn: (data: CreateSinistreDto) => sinistresApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      navigate('/sinistres');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Affaire *</label>
            <select
              required
              value={formData.affaireId}
              onChange={(e) => setFormData({ ...formData, affaireId: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Sélectionner une affaire</option>
              {affaires?.map((affaire: any) => (
                <option key={affaire.id} value={affaire.id}>
                  {affaire.numeroAffaire} - {affaire.assure?.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Référence Cédante *</label>
            <input
              required
              type="text"
              value={formData.referenceCedante}
              onChange={(e) => setFormData({ ...formData, referenceCedante: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Survenance *</label>
            <input
              required
              type="date"
              value={formData.dateSurvenance instanceof Date ? formData.dateSurvenance.toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, dateSurvenance: new Date(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Déclaration Cédante *</label>
            <input
              required
              type="date"
              value={formData.dateDeclarationCedante instanceof Date ? formData.dateDeclarationCedante.toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, dateDeclarationCedante: new Date(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant Total 100% *</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.montantTotal}
              onChange={(e) => setFormData({ ...formData, montantTotal: parseFloat(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Part Cédante *</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.montantCedantePart}
              onChange={(e) => setFormData({ ...formData, montantCedantePart: parseFloat(e.target.value) })}
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

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.cedantePaymentVerified}
              onChange={(e) => setFormData({ ...formData, cedantePaymentVerified: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Paiement cédante vérifié</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.expertiseRequise}
              onChange={(e) => setFormData({ ...formData, expertiseRequise: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Expertise requise</span>
          </label>
        </div>

        {formData.participations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Participations Réassureurs</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Réassureur</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Part %</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.participations.map((p, idx) => {
                    const reassureur = selectedAffaire?.reinsurers?.find((r: any) => r.reassureurId === p.reassureurId);
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{reassureur?.reassureur?.nom}</td>
                        <td className="px-4 py-2 text-sm">{p.partPourcentage}%</td>
                        <td className="px-4 py-2 text-sm font-semibold">{p.montantPart.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/sinistres')}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
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
