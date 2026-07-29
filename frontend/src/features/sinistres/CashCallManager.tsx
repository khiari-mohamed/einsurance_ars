import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Send, PhoneCall, DollarSign, FileCheck } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';
import type { CashCall, CashCallStatut } from '../../types/cash-call.types';

interface Props {
  sinistreId: string;
  cashCall?: CashCall | null;
}

const STATUT_CONFIG: Record<CashCallStatut, { label: string; color: string; icon: any }> = {
  DECLENCHE: { label: 'Déclenché', color: 'bg-blue-100 text-blue-800', icon: Clock },
  REINSUREUR_CONTACTE: { label: 'Réassureur Contacté', color: 'bg-purple-100 text-purple-800', icon: Send },
  EN_ATTENTE_PAIEMENT: { label: 'En Attente Paiement', color: 'bg-yellow-100 text-yellow-800', icon: PhoneCall },
  PAIEMENT_RECU: { label: 'Paiement Reçu', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  LETTRE: { label: 'Lettré', color: 'bg-gray-100 text-gray-800', icon: FileCheck },
};

// Mirrors CashCallService.advanceStatut()'s real transition map exactly —
// PAIEMENT_RECU is deliberately absent as a generic-advance target; it's
// only reachable through recordPayment() below.
const NEXT_STATUT: Partial<Record<CashCallStatut, CashCallStatut>> = {
  DECLENCHE: 'REINSUREUR_CONTACTE',
  REINSUREUR_CONTACTE: 'EN_ATTENTE_PAIEMENT',
  PAIEMENT_RECU: 'LETTRE',
};

export default function CashCallManager({ sinistreId, cashCall }: Props) {
  const queryClient = useQueryClient();
  const [triggerForm, setTriggerForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState(false);
  const [montantDemande, setMontantDemande] = useState(0);
  const [notes, setNotes] = useState('');
  const [montantRecu, setMontantRecu] = useState(0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sinistre', sinistreId] });

  const triggerMutation = useMutation({
    mutationFn: () => sinistresApi.triggerCashCall(sinistreId, { montantDemande, notes: notes || undefined }),
    onSuccess: () => { invalidate(); setTriggerForm(false); },
  });

  const advanceMutation = useMutation({
    mutationFn: (statut: CashCallStatut) => sinistresApi.advanceCashCall(sinistreId, statut),
    onSuccess: invalidate,
  });

  const paymentMutation = useMutation({
    mutationFn: () => sinistresApi.recordCashCallPayment(sinistreId, { montantRecu }),
    onSuccess: () => { invalidate(); setPaymentForm(false); },
  });

  if (!cashCall) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cash Call</h3>
        {!triggerForm ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">Aucun cash call déclenché pour ce sinistre.</p>
            <Button onClick={() => setTriggerForm(true)}>Déclencher un Cash Call</Button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); triggerMutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Montant Demandé (TND)</label>
              <input
                type="number" step="0.001" required
                value={montantDemande}
                onChange={(e) => setMontantDemande(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={triggerMutation.isPending}>
                {triggerMutation.isPending ? 'Déclenchement...' : 'Déclencher'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setTriggerForm(false)}>Annuler</Button>
            </div>
          </form>
        )}
      </Card>
    );
  }

  const config = STATUT_CONFIG[cashCall.statut];
  const StatusIcon = config.icon;
  const nextStatut = NEXT_STATUT[cashCall.statut];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Cash Call</h3>
        <Badge className={config.color}>
          <StatusIcon size={14} className="mr-1" />
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-600">Montant Demandé</div>
          <div className="font-semibold text-lg">{formatCurrency(cashCall.montantDemande)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Montant Reçu</div>
          <div className="font-semibold text-lg">
            {cashCall.montantRecu != null ? formatCurrency(cashCall.montantRecu) : '—'}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Date Déclenchement</div>
          <div>{new Date(cashCall.dateDeclenche).toLocaleDateString('fr-FR')}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Date Paiement</div>
          <div>{cashCall.datePaiement ? new Date(cashCall.datePaiement).toLocaleDateString('fr-FR') : '—'}</div>
        </div>
      </div>

      {cashCall.notes && (
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-1">Notes</div>
          <div className="text-sm">{cashCall.notes}</div>
        </div>
      )}

      {/* Payment capture — the only path to PAIEMENT_RECU */}
      {cashCall.statut === 'EN_ATTENTE_PAIEMENT' && (
        !paymentForm ? (
          <Button onClick={() => setPaymentForm(true)} className="gap-2">
            <DollarSign size={16} /> Enregistrer le Paiement
          </Button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); paymentMutation.mutate(); }} className="space-y-3 border-t pt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Montant Reçu (TND)</label>
              <input
                type="number" step="0.001" required
                value={montantRecu}
                onChange={(e) => setMontantRecu(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Enregistrement...' : 'Confirmer le Paiement'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPaymentForm(false)}>Annuler</Button>
            </div>
          </form>
        )
      )}

      {/* Generic linear advance, for every transition except → PAIEMENT_RECU */}
      {nextStatut && cashCall.statut !== 'EN_ATTENTE_PAIEMENT' && (
        <Button
          variant="outline"
          onClick={() => advanceMutation.mutate(nextStatut)}
          disabled={advanceMutation.isPending}
        >
          Passer à « {STATUT_CONFIG[nextStatut].label} »
        </Button>
      )}
    </Card>
  );
}