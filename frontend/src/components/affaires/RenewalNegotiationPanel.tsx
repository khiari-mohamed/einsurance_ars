import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Affaire, NegotiationStatus, NegotiationSubject } from '../../types/affaire.types';
import { affairesApi } from '../../api/affaires.api';

const subjects: Array<[NegotiationSubject, string]> = [
  ['PRIME_TAUX', 'Prime / taux'],
  ['RETENTION', 'Rétention'],
  ['CAPACITE', 'Capacité'],
  ['COMMISSION_COURTAGE', 'Commission de courtage'],
  ['PARTICIPATION_BENEFICIAIRE', 'Participation bénéficiaire'],
  ['AUTRE', 'Autre'],
];

const statuses: Array<[NegotiationStatus, string]> = [
  ['EN_COURS', 'En cours'],
  ['ACCEPTEE', 'Acceptée'],
  ['REFUSEE', 'Refusée'],
];

interface Props { affaire: Affaire; }

export default function RenewalNegotiationPanel({ affaire }: Props) {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState(affaire.renouvellementDetails ?? '');
  const [form, setForm] = useState({
    round: 1, date: new Date().toISOString().slice(0, 10), counterparty: '',
    subject: 'AUTRE' as NegotiationSubject, currentValue: '', proposedValue: '',
    status: 'EN_COURS' as NegotiationStatus, deadline: '', notes: '',
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
  const detailsMutation = useMutation({
    mutationFn: () => affairesApi.updateRenewalDetails(affaire.id, details),
    onSuccess: invalidate,
  });
  const createMutation = useMutation({
    mutationFn: () => affairesApi.createNegotiation(affaire.id, form),
    onSuccess: () => {
      invalidate();
      setForm({ ...form, round: form.round + 1, counterparty: '', currentValue: '', proposedValue: '', notes: '' });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => affairesApi.deleteNegotiation(affaire.id, id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[14px] font-semibold text-foreground mb-2">Détails du renouvellement / de la négociation</h3>
        <div className="flex gap-2">
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px]" rows={3} placeholder="Décrire les conditions ou le contexte du renouvellement..." />
          <button type="button" onClick={() => detailsMutation.mutate()} disabled={detailsMutation.isPending} className="self-end rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">Enregistrer</button>
        </div>
      </div>
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-semibold text-foreground mb-3">Historique des négociations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="number" min={1} value={form.round} onChange={(e) => setForm({ ...form, round: Number(e.target.value) || 1 })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" placeholder="Tour" />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" />
          <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" placeholder="Interlocuteur / partie" />
          <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value as NegotiationSubject })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">{subjects.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" placeholder="Valeur actuelle" />
          <input value={form.proposedValue} onChange={(e) => setForm({ ...form, proposedValue: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" placeholder="Valeur proposée" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as NegotiationStatus })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs" />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-xs md:col-span-3" placeholder="Notes" />
        </div>
        <button type="button" onClick={() => createMutation.mutate()} disabled={!form.counterparty.trim() || createMutation.isPending} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs text-primary-foreground disabled:opacity-50">Ajouter une négociation</button>
        <div className="mt-4 space-y-2">
          {(affaire.negotiations ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div><strong>Tour {item.round} · {new Date(item.date).toLocaleDateString('fr-FR')}</strong> — {item.counterparty} · {subjects.find(([value]) => value === item.subject)?.[1]}</div>
                <button type="button" onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">Supprimer</button>
              </div>
              <div className="mt-1 text-muted-foreground">Actuel: {item.currentValue || '—'} · Proposé: {item.proposedValue || '—'} · {statuses.find(([value]) => value === item.status)?.[1]}</div>
              {item.notes && <div className="mt-1">{item.notes}</div>}
            </div>
          ))}
          {(affaire.negotiations ?? []).length === 0 && <p className="text-xs text-muted-foreground">Aucune négociation enregistrée.</p>}
        </div>
      </div>
    </div>
  );
}
