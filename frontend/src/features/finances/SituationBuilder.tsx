import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, AlertCircle } from 'lucide-react';
import masterDataApi from '@/api/master-data.api';
import traitesApi from '@/api/traites.api';
import { financesApi } from '@/api/finances.api';
import { CreateSituationInput, Situation, soldeDirectionLabels } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface Props {
  onCreated?: (situation: Situation) => void;
}

// FIX (Finances pass): full rewrite. This was a manual "browse and pick
// individual affaires" builder posting to a nonexistent /api/affaires and
// /api/finances/situations REST-style endpoint. The real
// POST /finances/situations does the affaire selection automatically —
// it queries every PLACEMENT_REALISE affaire for the given cedante (and
// traité, if scoped) with modePaiement=PAR_SITUATION and compiles the
// netting itself. The frontend's job is just to specify the scope
// (cedante, période, traité optionnel) and show the compiled result.
export default function SituationBuilder({ onCreated }: Props) {
  const queryClient = useQueryClient();
  const [cedanteId, setCedanteId] = useState('');
  const [traiteId, setTraiteId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [currency, setCurrency] = useState('TND');
  const [result, setResult] = useState<Situation | null>(null);

  const { data: cedantes = [] } = useQuery({
    queryKey: ['cedantes-lite'],
    queryFn: async () => (await masterDataApi.cedantes.getAll({ limit: 500 })).data.data,
  });

  const { data: traites = [] } = useQuery({
    queryKey: ['traites-for-cedante', cedanteId],
    queryFn: async () => (await traitesApi.getAll({ cedanteId, limit: 100 })).data.data,
    enabled: !!cedanteId,
  });

  const compileMutation = useMutation({
    mutationFn: (data: CreateSituationInput) => financesApi.createSituation(data),
    onSuccess: ({ data }) => {
      toast.success(`Situation ${data.reference} compilée avec succès`);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['situations'] });
      onCreated?.(data);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Erreur lors de la compilation'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedanteId || !dateDebut || !dateFin) {
      toast.error('Cédante et période requises');
      return;
    }
    compileMutation.mutate({
      cedanteId,
      traiteId: traiteId || undefined,
      dateDebut,
      dateFin,
      currency,
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cédante *</Label>
              <Select value={cedanteId} onValueChange={(v) => { setCedanteId(v); setTraiteId(''); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {cedantes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.raisonSociale}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Traité (optionnel — restreint aux affaires de ce traité)</Label>
              <Select value={traiteId} onValueChange={setTraiteId} disabled={!cedanteId}>
                <SelectTrigger><SelectValue placeholder="Tous les traités" /></SelectTrigger>
                <SelectContent>
                  {traites.map((t: any) => (
                    <SelectItem key={t.affaireId} value={t.affaireId}>{t.referenceTraite || t.affaire?.numero}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Début *</Label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <Label>Date Fin *</Label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['TND', 'EUR', 'USD', 'GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Seules les affaires placées, au mode de paiement "Par Situation", sont éligibles. La compilation calcule
            automatiquement le débit (primes cédées nettes de commission) et le crédit (sinistres réglés) par affaire.
          </p>

          <div className="flex justify-end">
            <Button type="submit" disabled={compileMutation.isPending}>
              <Calculator className="mr-2 h-4 w-4" />
              {compileMutation.isPending ? 'Compilation...' : 'Compiler la Situation'}
            </Button>
          </div>
        </form>

        {result && (
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Situation {result.reference}</h3>
              <span className="text-sm text-gray-500">{result.lines.length} affaire(s)</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">DÉBIT (Primes)</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(result.totalDebit ?? 0, result.currency)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">CRÉDIT (Sinistres)</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(result.totalCredit ?? 0, result.currency)}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">SOLDE NET</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(result.soldeNet ?? 0, result.currency)}</p>
              </div>
            </div>

            {result.soldeDirection && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                <AlertCircle size={16} className="text-gray-500" />
                {soldeDirectionLabels[result.soldeDirection]}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Affaire</th>
                    <th className="px-3 py-2 text-right">Débit</th>
                    <th className="px-3 py-2 text-right">Crédit</th>
                    <th className="px-3 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-mono">{l.affaire?.numero || l.description}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.debit ?? 0, result.currency)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.credit ?? 0, result.currency)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(l.solde ?? 0, result.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-400">
              Une tâche de transfert vers la DAF a été créée automatiquement pour cette situation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}