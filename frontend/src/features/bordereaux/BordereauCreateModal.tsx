import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { BordereauType, CreateBordereauDto } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import api from '../../lib/api';

interface BordereauCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BORDEREAU_TYPES: { value: BordereauType; label: string; description: string }[] = [
  { value: 'cession', label: 'Bordereau de Cession', description: 'Pour les cessions de risques à ARS' },
  { value: 'reassureur', label: 'Bordereau Réassureur', description: 'Pour les parts des réassureurs' },
  { value: 'sinistre', label: 'Bordereau Sinistre', description: 'Pour les déclarations de sinistres' },
  { value: 'situation', label: 'Bordereau de Situation', description: 'État de compte global' },
];

export default function BordereauCreateModal({ isOpen, onClose }: BordereauCreateModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<CreateBordereauDto>({
    type: 'cession',
    cedanteId: '',
    dateDebut: '',
    dateFin: '',
    dateEmission: new Date().toISOString().split('T')[0],
    devise: 'TND',
    notes: '',
    affaireIds: [],
  });

  const [selectedAffaires, setSelectedAffaires] = useState<string[]>([]);
  
  const [commissionRates, setCommissionRates] = useState({
    commissionCedante: 0,
    commissionARS: 0,
  });

  // Fetch cedantes
  const { data: cedantes } = useQuery({
    queryKey: ['cedantes'],
    queryFn: () => api.get('/cedantes'),
  });

  // Fetch reassureurs
  const { data: reassureurs } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: () => api.get('/reassureurs'),
    enabled: formData.type === 'reassureur',
  });

  // Fetch affaires for selection
  const { data: affaires } = useQuery({
    queryKey: ['affaires', formData.cedanteId],
    queryFn: () => api.get('/affaires', { params: { cedanteId: formData.cedanteId, limit: 100 } }),
    enabled: !!formData.cedanteId,
  });

  // Calculate totals from selected affaires
  const calculateTotals = () => {
    if (!affaires?.data?.data || selectedAffaires.length === 0) return null;
    const selected = affaires.data.data.filter((a: any) => selectedAffaires.includes(a.id));
    const totalPrime = selected.reduce((sum: number, a: any) => sum + (a.primeCedee || 0), 0);
    const totalCommCedante = (totalPrime * commissionRates.commissionCedante) / 100;
    const totalCommARS = (totalPrime * commissionRates.commissionARS) / 100;
    return { totalPrime, totalCommCedante, totalCommARS, netAPayer: totalPrime - totalCommCedante - totalCommARS };
  };

  const totals = calculateTotals();

  const createMutation = useMutation({
    mutationFn: (data: CreateBordereauDto) => bordereauxApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      type: 'cession',
      cedanteId: '',
      dateDebut: '',
      dateFin: '',
      dateEmission: new Date().toISOString().split('T')[0],
      devise: 'TND',
      notes: '',
      affaireIds: [],
    });
    setSelectedAffaires([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cedanteId) {
      alert('Veuillez sélectionner une cédante');
      return;
    }

    if (formData.type === 'reassureur' && !formData.reassureurId) {
      alert('Veuillez sélectionner un réassureur');
      return;
    }

    const submitData = {
      ...formData,
      affaireIds: selectedAffaires.length > 0 ? selectedAffaires : undefined,
    };

    createMutation.mutate(submitData);
  };

  const toggleAffaire = (affaireId: string) => {
    setSelectedAffaires(prev =>
      prev.includes(affaireId)
        ? prev.filter(id => id !== affaireId)
        : [...prev, affaireId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Créer un Bordereau</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Type de Bordereau <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {BORDEREAU_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.type === type.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold">{type.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cedante */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cédante <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.cedanteId}
                  onChange={(e) => setFormData({ ...formData, cedanteId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner une cédante</option>
                  {cedantes?.data?.data?.map((cedante: any) => (
                    <option key={cedante.id} value={cedante.id}>
                      {cedante.raisonSociale}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reassureur (if type is reassureur) */}
              {formData.type === 'reassureur' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Réassureur <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.reassureurId || ''}
                    onChange={(e) => setFormData({ ...formData, reassureurId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un réassureur</option>
                    {reassureurs?.data?.data?.map((reassureur: any) => (
                      <option key={reassureur.id} value={reassureur.id}>
                        {reassureur.raisonSociale}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Devise */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Devise <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.devise}
                  onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="TND">TND - Dinar Tunisien</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - Dollar US</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Date Debut */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Date Début <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateDebut}
                  onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              {/* Date Fin */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Date Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateFin}
                  onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                  min={formData.dateDebut}
                />
              </div>

              {/* Date Emission */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Date Émission <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateEmission}
                  onChange={(e) => setFormData({ ...formData, dateEmission: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>

            {/* Date Limite Paiement */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Date Limite de Paiement
              </label>
              <input
                type="date"
                value={formData.dateLimitePaiement || ''}
                onChange={(e) => setFormData({ ...formData, dateLimitePaiement: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                min={formData.dateEmission}
              />
            </div>

            {/* Commission Rates */}
            {selectedAffaires.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Commission Cédante (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={commissionRates.commissionCedante}
                    onChange={(e) => setCommissionRates({ ...commissionRates, commissionCedante: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Commission ARS (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={commissionRates.commissionARS}
                    onChange={(e) => setCommissionRates({ ...commissionRates, commissionARS: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            )}

            {/* Calculated Totals */}
            {totals && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Calculs Prévisionnels</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Prime Totale:</div>
                  <div className="font-semibold text-right">{totals.totalPrime.toLocaleString()} {formData.devise}</div>
                  <div>Commission Cédante:</div>
                  <div className="font-semibold text-right">{totals.totalCommCedante.toLocaleString()} {formData.devise}</div>
                  <div>Commission ARS:</div>
                  <div className="font-semibold text-right">{totals.totalCommARS.toLocaleString()} {formData.devise}</div>
                  <div className="font-bold">Net à Payer:</div>
                  <div className="font-bold text-right">{totals.netAPayer.toLocaleString()} {formData.devise}</div>
                </div>
              </div>
            )}

            {/* Affaires Selection */}
            {formData.cedanteId && affaires?.data?.data && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Affaires à Inclure ({selectedAffaires.length} sélectionnée(s))
                </label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {affaires.data.data.map((affaire: any) => (
                    <label
                      key={affaire.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAffaires.includes(affaire.id)}
                        onChange={() => toggleAffaire(affaire.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{affaire.numeroAffaire}</p>
                        <p className="text-sm text-gray-600">
                          {affaire.assure?.raisonSociale} - {affaire.primeCedee?.toLocaleString()} {affaire.devise}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
                placeholder="Notes ou commentaires..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Création...' : 'Créer le Bordereau'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                disabled={createMutation.isPending}
              >
                Annuler
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
