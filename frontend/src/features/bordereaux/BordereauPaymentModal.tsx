import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, DollarSign } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { Bordereau, PaymentMode } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

interface BordereauPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bordereau: Bordereau;
}

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'virement', label: 'Virement Bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'traite', label: 'Traite' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'autre', label: 'Autre' },
];

export default function BordereauPaymentModal({ isOpen, onClose, bordereau }: BordereauPaymentModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    montant: bordereau.solde,
    modePaiement: 'virement' as PaymentMode,
    datePaiement: new Date().toISOString().split('T')[0],
    referenceBancaire: '',
    notes: '',
  });
  const [paymentDocument, setPaymentDocument] = useState<File | null>(null);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      await bordereauxApi.markAsPaid(bordereau.id, formData);
      if (paymentDocument) {
        await bordereauxApi.addDocument(
          bordereau.id,
          paymentDocument,
          'releve_bancaire',
          `Preuve de paiement - ${formData.modePaiement}`
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', bordereau.id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.montant <= 0) {
      alert('Le montant doit être supérieur à 0');
      return;
    }
    if (formData.montant > bordereau.solde) {
      if (!confirm(`Le montant (${formData.montant}) dépasse le solde (${bordereau.solde}). Continuer ?`)) {
        return;
      }
    }
    paymentMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Enregistrer un Paiement</h2>
                <p className="text-gray-600">Bordereau {bordereau.numero}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Solde actuel:</span>
                <p className="text-xl font-bold text-blue-900">
                  {bordereau.solde.toLocaleString()} {bordereau.devise}
                </p>
              </div>
              {bordereau.acompteRecu > 0 && (
                <div>
                  <span className="text-gray-600">Acomptes reçus:</span>
                  <p className="text-lg font-semibold text-green-600">
                    {bordereau.acompteRecu.toLocaleString()} {bordereau.devise}
                  </p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Montant du Paiement <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-4 py-2 pr-16"
                  required
                  min="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  {bordereau.devise}
                </span>
              </div>
              {formData.montant < bordereau.solde && (
                <p className="text-sm text-orange-600 mt-1">
                  Paiement partiel. Solde restant: {(bordereau.solde - formData.montant).toLocaleString()} {bordereau.devise}
                </p>
              )}
              {formData.montant === bordereau.solde && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Paiement complet
                </p>
              )}
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Mode de Paiement <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.modePaiement}
                onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value as PaymentMode })}
                className="w-full border rounded-lg px-4 py-2"
                required
              >
                {PAYMENT_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Date de Paiement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.datePaiement}
                onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Bank Reference */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Référence Bancaire
              </label>
              <input
                type="text"
                value={formData.referenceBancaire}
                onChange={(e) => setFormData({ ...formData, referenceBancaire: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                placeholder="N° de transaction, chèque, etc."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                rows={3}
                placeholder="Informations complémentaires..."
              />
            </div>

            {/* Payment Document */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Preuve de Paiement (Relevé Bancaire)
              </label>
              <input
                type="file"
                onChange={(e) => setPaymentDocument(e.target.files?.[0] || null)}
                className="w-full border rounded-lg px-4 py-2"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formats acceptés: PDF, JPEG, PNG (max 10 MB)
              </p>
              {paymentDocument && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {paymentDocument.name}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                className="flex-1"
                disabled={paymentMutation.isPending}
              >
                {paymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer le Paiement'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={paymentMutation.isPending}
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
