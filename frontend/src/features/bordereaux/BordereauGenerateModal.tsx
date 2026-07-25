import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Zap } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { BordereauType } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import api from '../../lib/api';
import masterDataApi from '../../api/master-data.api';

interface Props { isOpen: boolean; onClose: () => void }

// Only the three types the backend's generate() actually implements —
// SITUATION_TRAITE/NOTE_DE_CREDIT/etc. must be created manually via
// BordereauCreateModal until a generator is written for them.
const GENERATABLE_TYPES: { value: BordereauType; label: string; description: string }[] = [
  { value: 'CESSION_CEDANTE', label: 'Cession Cédante', description: 'Un bordereau pour la cédante de l\'affaire' },
  { value: 'CESSION_REASSUREUR', label: 'Cession Réassureur', description: 'Un bordereau par réassureur participant (ou un seul si filtré)' },
  { value: 'SINISTRE_FACULTATIVE', label: 'Sinistre Facultative', description: 'Regroupe les sinistres validés de l\'affaire sur la période' },
];

export default function BordereauGenerateModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    type: 'CESSION_CEDANTE' as BordereauType,
    affaireId: '',
    reassureurId: '',
    datePeriodeDebut: '',
    datePeriodeFin: '',
    dateLimitePaiement: '',
  });

  const { data: affaires } = useQuery({
    queryKey: ['affaires-placees'],
    queryFn: () => api.get('/affaires', { params: { statut: 'PLACEMENT_REALISE', limit: 200 } }),
  });

  const { data: reassureurs } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll()).data,
    enabled: formData.type === 'CESSION_REASSUREUR',
  });

  const generateMutation = useMutation({
    mutationFn: () => bordereauxApi.generate({
      affaireId: formData.affaireId,
      type: formData.type,
      reassureurId: formData.reassureurId || undefined,
      datePeriodeDebut: formData.datePeriodeDebut || undefined,
      datePeriodeFin: formData.datePeriodeFin || undefined,
      dateLimitePaiement: formData.dateLimitePaiement || undefined,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      alert(`${res.data.length} bordereau(x) généré(s) avec succès`);
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erreur lors de la génération');
    },
  });

  const resetForm = () => setFormData({ type: 'CESSION_CEDANTE', affaireId: '', reassureurId: '', datePeriodeDebut: '', datePeriodeFin: '', dateLimitePaiement: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.affaireId) { alert('Veuillez sélectionner une affaire'); return; }
    generateMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><Zap className="text-yellow-600" size={24} /></div>
              <div>
                <h2 className="text-2xl font-bold">Génération Automatique</h2>
                <p className="text-gray-600">À partir des données d'une affaire placée</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 gap-3">
                {GENERATABLE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t.value, reassureurId: '' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${formData.type === t.value ? 'border-yellow-600 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="font-semibold">{t.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Affaire (placée) <span className="text-red-500">*</span></label>
              <select value={formData.affaireId} onChange={(e) => setFormData({ ...formData, affaireId: e.target.value })} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">Sélectionner une affaire</option>
                {affaires?.data?.data?.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.numero} — {a.cedante?.raisonSociale}</option>
                ))}
              </select>
            </div>

            {formData.type === 'CESSION_REASSUREUR' && (
              <div>
                <label className="block text-sm font-medium mb-2">Réassureur (optionnel — sinon un bordereau par réassureur)</label>
                <select value={formData.reassureurId} onChange={(e) => setFormData({ ...formData, reassureurId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Tous les réassureurs de l'affaire</option>
                  {reassureurs?.data?.map((r: any) => <option key={r.id} value={r.id}>{r.raisonSociale}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date Début</label>
                <input type="date" value={formData.datePeriodeDebut} onChange={(e) => setFormData({ ...formData, datePeriodeDebut: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date Fin</label>
                <input type="date" value={formData.datePeriodeFin} onChange={(e) => setFormData({ ...formData, datePeriodeFin: e.target.value })} className="w-full border rounded-lg px-3 py-2" min={formData.datePeriodeDebut} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date Limite Paiement</label>
                <input type="date" value={formData.dateLimitePaiement} onChange={(e) => setFormData({ ...formData, dateLimitePaiement: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note :</strong> l'affaire doit être au statut <code>PLACEMENT_REALISE</code>. Pour "Sinistre Facultative", seuls les sinistres validés (ou plus avancés) sur la période sont inclus.
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1 gap-2" disabled={generateMutation.isPending}>
                <Zap size={18} /> {generateMutation.isPending ? 'Génération...' : 'Générer'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }} disabled={generateMutation.isPending}>Annuler</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}