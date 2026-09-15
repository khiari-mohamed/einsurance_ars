import { useState } from 'react';
import { Plus, Trash2, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { traitesApi } from '../../api/traites.api';
import { extractErrorMessage } from '../../lib/api';

interface PMDInstalment {
  id?: string;
  numero: number;
  montant: number;
  pourcentage: number;
  dateEcheance: string;
  statut: 'en_attente' | 'paye' | 'retard';
  datePaiement?: string;
  reference?: string;
}

interface PMDInstalmentScheduleProps {
  affaireId: string;
  pmdTotal: number;
  devise: string;
  onSave?: (instalments: PMDInstalment[]) => void;
}

export default function PMDInstalmentSchedule({
  affaireId,
  pmdTotal,
  devise,
  onSave,
}: PMDInstalmentScheduleProps) {
  const [instalments, setInstalments] = useState<PMDInstalment[]>([
    { numero: 1, montant: pmdTotal * 0.5, pourcentage: 50, dateEcheance: '', statut: 'en_attente' },
    { numero: 2, montant: pmdTotal * 0.5, pourcentage: 50, dateEcheance: '', statut: 'en_attente' },
  ]);
  const [saving, setSaving] = useState(false);

  const addInstalment = () => {
    const newInstalment: PMDInstalment = {
      numero: instalments.length + 1,
      montant: 0,
      pourcentage: 0,
      dateEcheance: '',
      statut: 'en_attente',
    };
    setInstalments([...instalments, newInstalment]);
  };

  const removeInstalment = (index: number) => {
    if (instalments.length <= 1) {
      toast.error('Au moins une échéance est requise');
      return;
    }
    setInstalments(instalments.filter((_, i) => i !== index));
  };

  const updateInstalment = (index: number, field: keyof PMDInstalment, value: any) => {
    const updated = [...instalments];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'montant') {
      updated[index].pourcentage = pmdTotal > 0 ? (value / pmdTotal) * 100 : 0;
    }
    if (field === 'pourcentage') {
      updated[index].montant = (value / 100) * pmdTotal;
    }

    setInstalments(updated);
  };

  const getTotalMontant = () => instalments.reduce((sum, inst) => sum + Number(inst.montant || 0), 0);
  const getTotalPourcentage = () => instalments.reduce((sum, inst) => sum + Number(inst.pourcentage || 0), 0);

  const handleSave = async () => {
    const total = getTotalPourcentage();
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Le total doit être 100% (actuellement ${total.toFixed(2)}%)`);
      return;
    }
    if (instalments.some((i) => !i.dateEcheance)) {
      toast.error('Chaque échéance doit avoir une date.');
      return;
    }

    setSaving(true);
    try {
      await traitesApi.replacePmdInstalments(
        affaireId,
        instalments.map((inst) => ({
          numeroTranche: inst.numero,
          dateEcheance: inst.dateEcheance,
          montant: inst.montant,
        })),
      );
      toast.success('Échéancier PMD enregistré avec succès');
      if (onSave) onSave(instalments);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Erreur lors de l\'enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const totalMontant = getTotalMontant();
  const totalPourcentage = getTotalPourcentage();
  const isValid = Math.abs(totalPourcentage - 100) < 0.01;

  return (
    <div className="bg-card rounded-[var(--radius)] border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-primary" size={24} />
          <div>
            <h3 className="text-lg font-bold">Échéancier PMD (Prime Minimum et Dépôt)</h3>
            <p className="text-sm text-muted-foreground">
              PMD Total: {pmdTotal.toLocaleString()} {devise}
            </p>
          </div>
        </div>
        <button
          onClick={addInstalment}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} />
          Ajouter Échéance
        </button>
      </div>

      <div className="space-y-4">
        {instalments.map((inst, index) => (
          <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Échéance #{inst.numero}</h4>
              {instalments.length > 1 && (
                <button
                  onClick={() => removeInstalment(index)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Montant ({devise})</label>
                <input
                  type="number"
                  value={inst.montant}
                  onChange={(e) => updateInstalment(index, 'montant', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pourcentage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={inst.pourcentage.toFixed(2)}
                  onChange={(e) => updateInstalment(index, 'pourcentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date d'Échéance</label>
                <input
                  type="date"
                  value={inst.dateEcheance}
                  onChange={(e) => updateInstalment(index, 'dateEcheance', e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statut (local — non persisté)</label>
                <select
                  value={inst.statut}
                  onChange={(e) => updateInstalment(index, 'statut', e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
                >
                  <option value="en_attente">En Attente</option>
                  <option value="paye">Payé</option>
                  <option value="retard">En Retard</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/30">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Montant</p>
            <p className="text-xl font-bold text-blue-600">
              {totalMontant.toLocaleString()} {devise}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {Math.abs(totalMontant - pmdTotal) < 0.01 ? (
                <span className="text-green-600">✓ Correct</span>
              ) : (
                <span className="text-red-600">⚠ Écart: {(totalMontant - pmdTotal).toFixed(2)}</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Pourcentage</p>
            <p className="text-xl font-bold text-purple-600">{totalPourcentage.toFixed(2)}%</p>
            <p className="text-xs text-gray-600 mt-1">
              {isValid ? <span className="text-green-600">✓ Valide</span> : <span className="text-red-600">⚠ Doit être 100%</span>}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Nombre d'Échéances</p>
            <p className="text-xl font-bold text-gray-700">{instalments.length}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DollarSign size={16} />
          {saving ? 'Enregistrement...' : "Enregistrer l'Échéancier"}
        </button>
      </div>
    </div>
  );
}