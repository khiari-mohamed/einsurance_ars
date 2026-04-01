import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Zap, Calendar } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { BordereauType } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import api from '../../lib/api';

interface BordereauGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENERATION_TYPES = [
  { value: 'cession', label: 'Bordereau de Cession', description: 'Générer pour une période donnée' },
  { value: 'reassureur', label: 'Bordereau Réassureur', description: 'Générer par réassureur ou traité' },
  { value: 'sinistre', label: 'Bordereau Sinistre', description: 'Générer pour un sinistre spécifique' },
  { value: 'situation', label: 'Bordereau de Situation', description: 'État de compte global' },
];

export default function BordereauGenerateModal({ isOpen, onClose }: BordereauGenerateModalProps) {
  const queryClient = useQueryClient();
  
  const [generationType, setGenerationType] = useState<BordereauType>('cession');
  const [formData, setFormData] = useState({
    cedanteId: '',
    reassureurId: '',
    treatyId: '',
    sinistreId: '',
    entityType: 'cedante' as 'cedante' | 'reassureur',
    entityId: '',
    periodStart: '',
    periodEnd: '',
  });

  // Fetch data
  const { data: cedantes } = useQuery({
    queryKey: ['cedantes'],
    queryFn: () => api.get('/cedantes'),
  });

  const { data: reassureurs } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: () => api.get('/reassureurs'),
    enabled: generationType === 'reassureur' || generationType === 'situation',
  });

  const { data: traites } = useQuery({
    queryKey: ['traites', formData.cedanteId],
    queryFn: () => api.get('/affaires', { 
      params: { 
        cedanteId: formData.cedanteId, 
        category: 'traitee',
        limit: 100 
      } 
    }),
    enabled: generationType === 'reassureur' && !!formData.cedanteId,
  });

  const { data: sinistres } = useQuery({
    queryKey: ['sinistres'],
    queryFn: () => api.get('/sinistres', { params: { limit: 100 } }),
    enabled: generationType === 'sinistre',
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (generationType === 'sinistre') {
        return bordereauxApi.generateSinistre(formData.sinistreId);
      } else if (generationType === 'situation') {
        return bordereauxApi.generateSituation({
          entityType: formData.entityType,
          entityId: formData.entityId,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
        });
      } else {
        return bordereauxApi.generate({
          type: generationType,
          cedanteId: formData.cedanteId,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          treatyId: formData.treatyId || undefined,
          reassureurId: formData.reassureurId || undefined,
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      const count = Array.isArray(data.data) ? data.data.length : 1;
      alert(`${count} bordereau(x) généré(s) avec succès`);
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erreur lors de la génération');
    },
  });

  const resetForm = () => {
    setFormData({
      cedanteId: '',
      reassureurId: '',
      treatyId: '',
      sinistreId: '',
      entityType: 'cedante',
      entityId: '',
      periodStart: '',
      periodEnd: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (generationType === 'sinistre') {
      if (!formData.sinistreId) {
        alert('Veuillez sélectionner un sinistre');
        return;
      }
    } else if (generationType === 'situation') {
      if (!formData.entityId || !formData.periodStart || !formData.periodEnd) {
        alert('Veuillez remplir tous les champs requis');
        return;
      }
    } else {
      if (!formData.cedanteId || !formData.periodStart || !formData.periodEnd) {
        alert('Veuillez remplir tous les champs requis');
        return;
      }
    }

    generateMutation.mutate();
  };

  // Quick period presets
  const setQuickPeriod = (type: 'current_month' | 'last_month' | 'current_quarter' | 'last_quarter') => {
    const now = new Date();
    let start: Date, end: Date;

    switch (type) {
      case 'current_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        break;
      case 'last_quarter':
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        start = new Date(now.getFullYear(), lastQuarter * 3, 1);
        end = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0);
        break;
    }

    setFormData({
      ...formData,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Zap className="text-yellow-600" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Génération Automatique</h2>
                <p className="text-gray-600">Générer des bordereaux automatiquement</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Type de Génération <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {GENERATION_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setGenerationType(type.value as BordereauType);
                      resetForm();
                    }}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      generationType === type.value
                        ? 'border-yellow-600 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold">{type.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sinistre Generation */}
            {generationType === 'sinistre' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Sinistre <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sinistreId}
                  onChange={(e) => setFormData({ ...formData, sinistreId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner un sinistre</option>
                  {sinistres?.data?.data?.map((sinistre: any) => (
                    <option key={sinistre.id} value={sinistre.id}>
                      {sinistre.numeroSinistre} - {sinistre.montantTotal?.toLocaleString()} {sinistre.devise}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Situation Generation */}
            {generationType === 'situation' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type d'Entité <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="cedante"
                        checked={formData.entityType === 'cedante'}
                        onChange={(e) => setFormData({ ...formData, entityType: e.target.value as any, entityId: '' })}
                        className="rounded"
                      />
                      <span>Cédante</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="reassureur"
                        checked={formData.entityType === 'reassureur'}
                        onChange={(e) => setFormData({ ...formData, entityType: e.target.value as any, entityId: '' })}
                        className="rounded"
                      />
                      <span>Réassureur</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {formData.entityType === 'cedante' ? 'Cédante' : 'Réassureur'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {(formData.entityType === 'cedante' ? cedantes?.data?.data : reassureurs?.data?.data)?.map((entity: any) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.raisonSociale}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Cession/Reassureur Generation */}
            {(generationType === 'cession' || generationType === 'reassureur') && (
              <>
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

                {generationType === 'reassureur' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Traité (optionnel)
                      </label>
                      <select
                        value={formData.treatyId}
                        onChange={(e) => setFormData({ ...formData, treatyId: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Tous les traités</option>
                        {traites?.data?.data?.map((traite: any) => (
                          <option key={traite.id} value={traite.id}>
                            {traite.numeroAffaire} - {traite.type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Réassureur (optionnel)
                      </label>
                      <select
                        value={formData.reassureurId}
                        onChange={(e) => setFormData({ ...formData, reassureurId: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Tous les réassureurs</option>
                        {reassureurs?.data?.data?.map((reassureur: any) => (
                          <option key={reassureur.id} value={reassureur.id}>
                            {reassureur.raisonSociale}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Period Selection (for all except sinistre) */}
            {generationType !== 'sinistre' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Période Rapide
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuickPeriod('current_month')}
                      className="gap-2"
                    >
                      <Calendar size={14} />
                      Mois en cours
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuickPeriod('last_month')}
                      className="gap-2"
                    >
                      <Calendar size={14} />
                      Mois dernier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuickPeriod('current_quarter')}
                      className="gap-2"
                    >
                      <Calendar size={14} />
                      Trimestre en cours
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuickPeriod('last_quarter')}
                      className="gap-2"
                    >
                      <Calendar size={14} />
                      Trimestre dernier
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Date Début <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.periodStart}
                      onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Date Fin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.periodEnd}
                      onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                      min={formData.periodStart}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> La génération automatique créera un ou plusieurs bordereaux 
                en fonction des affaires trouvées pour la période sélectionnée.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={generateMutation.isPending}
              >
                <Zap size={18} />
                {generateMutation.isPending ? 'Génération...' : 'Générer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                disabled={generateMutation.isPending}
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
