import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, DollarSign } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { Bordereau, PaymentMode } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

interface Props { isOpen: boolean; onClose: () => void; bordereau: Bordereau }

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'VIREMENT', label: 'Virement Bancaire' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRAITE', label: 'Traite' },
  { value: 'COMPENSATION', label: 'Compensation' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function BordereauPaymentModal({ isOpen, onClose, bordereau }: Props) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    montant: bordereau.solde,
    modePaiement: 'VIREMENT' as PaymentMode,
    datePaiement: new Date().toISOString().split('T')[0],
    referenceBancaire: '',
    notes: '',
  });

  const paymentMutation = useMutation({
    mutationFn: () => bordereauxApi.pay(bordereau.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', bordereau.id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.montant <= 0) { alert('Le montant doit être supérieur à 0'); return; }
    if (formData.montant > bordereau.solde) {
      if (!confirm(`Le montant (${formData.montant}) dépasse le solde (${bordereau.solde}). Continuer ?`)) return;
    }
    paymentMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="text-green-600" size={24} /></div>
              <div><h2 className="text-2xl font-bold">Enregistrer un Paiement</h2><p className="text-gray-600">Bordereau {bordereau.numero}</p></div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-600">Solde actuel:</span><p className="text-xl font-bold text-blue-900">{Number(bordereau.solde).toLocaleString()} {bordereau.currency}</p></div>
              {bordereau.montantRegle > 0 && (
                <div><span className="text-gray-600">Déjà réglé:</span><p className="text-lg font-semibold text-green-600">{Number(bordereau.montantRegle).toLocaleString()} {bordereau.currency}</p></div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Montant du Paiement <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="0.001" value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2 pr-16" required min="0.001" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">{bordereau.currency}</span>
              </div>
              {formData.montant < bordereau.solde && <p className="text-sm text-orange-600 mt-1">Paiement partiel. Solde restant: {(Number(bordereau.solde) - formData.montant).toLocaleString()} {bordereau.currency}</p>}
              {formData.montant >= bordereau.solde && <p className="text-sm text-green-600 mt-1">✓ Ce paiement clôturera le bordereau (statut → Acquitté)</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mode de Paiement <span className="text-red-500">*</span></label>
              <select value={formData.modePaiement} onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value as PaymentMode })} className="w-full border rounded-lg px-4 py-2" required>
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date de Paiement <span className="text-red-500">*</span></label>
              <input type="date" value={formData.datePaiement} onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })} className="w-full border rounded-lg px-4 py-2" required max={new Date().toISOString().split('T')[0]} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Référence Bancaire</label>
              <input type="text" value={formData.referenceBancaire} onChange={(e) => setFormData({ ...formData, referenceBancaire: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="N° de transaction, chèque, etc." />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-lg px-4 py-2" rows={3} />
            </div>

            <p className="text-xs text-gray-500">
              Pour joindre un justificatif (relevé bancaire, avis SWIFT), utilisez l'onglet Documents après validation du paiement.
            </p>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer le Paiement'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={paymentMutation.isPending}>Annuler</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}