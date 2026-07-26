import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertCircle } from 'lucide-react';
import masterDataApi from '@/api/master-data.api';
import { financesApi } from '@/api/finances.api';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/currency';

// FIX (Finances pass): full rewrite. There is no "lettrage automatique"
// endpoint — POST /finances/lettrage/auto doesn't exist. The real workflow
// (matching CDC §12.6/lettrage material) is manual: pick a cedante, see its
// open (unpaid/partially-paid) bordereaux via GET /finances/lettrage/
// open-items/:cedanteId, pick an encaissement from that cedante, allocate
// amounts per bordereau up to each one's remaining balance, submit.
export default function LettrageView() {
  const queryClient = useQueryClient();
  const [cedanteId, setCedanteId] = useState('');
  const [encaissementId, setEncaissementId] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const { data: cedantes = [] } = useQuery({
    queryKey: ['cedantes-lite'],
    queryFn: async () => (await masterDataApi.cedantes.getAll({ limit: 500 })).data.data,
  });

  const { data: openItems = [] } = useQuery({
    queryKey: ['lettrage-open-items', cedanteId],
    queryFn: async () => (await financesApi.getOpenItems(cedanteId)).data,
    enabled: !!cedanteId,
  });

  const { data: encaissements = [] } = useQuery({
    queryKey: ['encaissements-for-cedante', cedanteId],
    queryFn: async () => (await financesApi.getEncaissements({ cedanteId, limit: 50 })).data.data,
    enabled: !!cedanteId,
  });

  const { data: history } = useQuery({
    queryKey: ['lettrages', cedanteId],
    queryFn: async () => (await financesApi.getLettrages({ cedanteId: cedanteId || undefined, limit: 20 })).data,
  });

  const selectedEncaissement = encaissements.find((e) => e.id === encaissementId);
  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);

  const lettrageMutation = useMutation({
    mutationFn: () => financesApi.createLettrage({
      encaissementId,
      cedanteId,
      matches: Object.entries(allocations).filter(([, v]) => v > 0).map(([bordereauId, montant]) => ({ bordereauId, montant })),
    }),
    onSuccess: ({ data }) => {
      toast.success(`Lettrage ${data.reference} enregistré — résiduel: ${data.residuel}`);
      setAllocations({});
      setEncaissementId('');
      queryClient.invalidateQueries({ queryKey: ['lettrage-open-items', cedanteId] });
      queryClient.invalidateQueries({ queryKey: ['lettrages'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Erreur lors du lettrage'),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Lettrage des Comptes Courants</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Cédante</label>
              <Select value={cedanteId} onValueChange={(v) => { setCedanteId(v); setAllocations({}); setEncaissementId(''); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{cedantes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.raisonSociale}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Encaissement à lettrer</label>
              <Select value={encaissementId} onValueChange={setEncaissementId} disabled={!cedanteId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {encaissements.map((e) => <SelectItem key={e.id} value={e.id}>{e.reference} — {formatCurrency(e.montant, e.currency)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {cedanteId && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Bordereaux ouverts ({openItems.length})</h4>
              {openItems.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun bordereau ouvert pour cette cédante.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Bordereau</th><th className="px-3 py-2 text-right">Solde restant</th><th className="px-3 py-2 text-right">Montant à lettrer</th></tr></thead>
                    <tbody className="divide-y">
                      {openItems.map((b: any) => (
                        <tr key={b.id}>
                          <td className="px-3 py-2 font-mono">{b.numero}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(b.montantRestant, b.currency)}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" step="0.001" min="0" max={b.montantRestant}
                              value={allocations[b.id] || ''}
                              onChange={(e) => setAllocations((prev) => ({ ...prev, [b.id]: parseFloat(e.target.value) || 0 }))}
                              disabled={!encaissementId}
                              className="w-32 border rounded px-2 py-1 text-right text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedEncaissement && (
            <div className={`p-3 rounded-lg text-sm flex items-center justify-between ${totalAllocated > selectedEncaissement.montant ? 'bg-red-50' : 'bg-blue-50'}`}>
              <span>Montant encaissé: <strong>{formatCurrency(selectedEncaissement.montant, selectedEncaissement.currency)}</strong> — Alloué: <strong>{formatCurrency(totalAllocated, selectedEncaissement.currency)}</strong></span>
              <Button size="sm" onClick={() => lettrageMutation.mutate()} disabled={totalAllocated <= 0 || totalAllocated > selectedEncaissement.montant || lettrageMutation.isPending}>
                {lettrageMutation.isPending ? 'Lettrage...' : 'Confirmer le Lettrage'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique des Lettrages</CardTitle></CardHeader>
        <CardContent>
          {!history || history.data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun lettrage trouvé</div>
          ) : (
            <div className="space-y-3">
              {history.data.map((l) => (
                <div key={l.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold font-mono">{l.reference}</p>
                      <p className="text-xs text-gray-500">{formatDate(l.dateLettre)} — {l.items.length} bordereau(x)</p>
                    </div>
                    {l.isComplete ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Complet</span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600 text-sm"><AlertCircle size={14} /> Résiduel: {formatCurrency(l.residuel ?? 0)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-green-50 p-2 rounded"><p className="text-gray-500">Encaissé</p><p className="font-semibold">{formatCurrency(l.montantEncaisse)}</p></div>
                    <div className="bg-blue-50 p-2 rounded"><p className="text-gray-500">Lettré</p><p className="font-semibold">{formatCurrency(l.montantLettre ?? 0)}</p></div>
                    <div className="bg-gray-50 p-2 rounded"><p className="text-gray-500">Résiduel</p><p className="font-semibold">{formatCurrency(l.residuel ?? 0)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}