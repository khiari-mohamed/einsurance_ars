import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { Bordereau, BordereauLine, UpdateBordereauDto } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import masterDataApi from '../../api/master-data.api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bordereau: Bordereau;
}

// Server enforces BROUILLON-only editing (BordereauxService.update() throws
// otherwise) — mirrored client-side by BordereauDetail only rendering the
// "Modifier" button when statut === 'BROUILLON', same pattern as the other
// workflow-gated actions in this module.

const emptyLine = (): BordereauLine => ({ libelle: '', ordre: 0 });

export default function BordereauEditModal({ isOpen, onClose, bordereau }: Props) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<UpdateBordereauDto>({
    cedanteId: bordereau.cedanteId,
    reassureurCode: bordereau.reassureurCode,
    datePeriodeDebut: bordereau.datePeriodeDebut?.slice(0, 10),
    datePeriodeFin: bordereau.datePeriodeFin?.slice(0, 10),
    dateLimitePaiement: bordereau.dateLimitePaiement?.slice(0, 10),
    currency: bordereau.currency,
    notes: bordereau.notes ?? '',
  });
  const [lines, setLines] = useState<BordereauLine[]>(
    bordereau.lines?.length ? bordereau.lines.map((l) => ({ ...l })) : [emptyLine()],
  );

  // Re-sync if a different bordereau is opened while the modal instance persists
  useEffect(() => {
    setFormData({
      cedanteId: bordereau.cedanteId,
      reassureurCode: bordereau.reassureurCode,
      datePeriodeDebut: bordereau.datePeriodeDebut?.slice(0, 10),
      datePeriodeFin: bordereau.datePeriodeFin?.slice(0, 10),
      dateLimitePaiement: bordereau.dateLimitePaiement?.slice(0, 10),
      currency: bordereau.currency,
      notes: bordereau.notes ?? '',
    });
    setLines(bordereau.lines?.length ? bordereau.lines.map((l) => ({ ...l })) : [emptyLine()]);
  }, [bordereau.id]);

  const { data: cedantes } = useQuery({
    queryKey: ['cedantes'],
    queryFn: async () => (await masterDataApi.cedantes.getAll()).data,
  });

  const { data: reassureurs } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll()).data,
    enabled: bordereau.type === 'CESSION_REASSUREUR',
  });

  const totalPrimeNette = lines.reduce((s, l) => s + (l.primeNette ?? l.primeBrute ?? 0), 0);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateBordereauDto) => bordereauxApi.update(bordereau.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', bordereau.id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      onClose();
    },
  });

  const updateLine = (index: number, patch: Partial<BordereauLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lines.some((l) => l.libelle.trim())) {
      alert('Veuillez renseigner au moins une ligne avec un libellé');
      return;
    }
    updateMutation.mutate({
      ...formData,
      lines: lines.filter((l) => l.libelle.trim()).map((l, i) => ({ ...l, ordre: i + 1 })),
    });
  };

  if (!isOpen) return null;

  const needsCedante = bordereau.type !== 'CESSION_REASSUREUR' && bordereau.type !== 'ETAT_DE_TRANSFERT';
  const needsReassureur = bordereau.type === 'CESSION_REASSUREUR' || bordereau.type === 'ETAT_DE_TRANSFERT';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Modifier le Bordereau</h2>
              <p className="text-gray-600 text-sm mt-1">{bordereau.numero} — {bordereau.type}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {needsCedante && (
                <div>
                  <label className="block text-sm font-medium mb-2">Cédante</label>
                  <select
                    value={formData.cedanteId || ''}
                    onChange={(e) => setFormData({ ...formData, cedanteId: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">— Aucune —</option>
                    {cedantes?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
                  </select>
                </div>
              )}

              {needsReassureur && (
                <div>
                  <label className="block text-sm font-medium mb-2">Réassureur</label>
                  <select
                    value={formData.reassureurCode || ''}
                    onChange={(e) => setFormData({ ...formData, reassureurCode: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Sélectionner un réassureur</option>
                    {reassureurs?.data?.map((r: any) => (
                      <option key={r.id} value={r.code}>{r.raisonSociale} ({r.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Devise</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Période Début</label>
                <input type="date" value={formData.datePeriodeDebut || ''} onChange={(e) => setFormData({ ...formData, datePeriodeDebut: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Période Fin</label>
                <input type="date" value={formData.datePeriodeFin || ''} onChange={(e) => setFormData({ ...formData, datePeriodeFin: e.target.value })} className="w-full border rounded-lg px-3 py-2" min={formData.datePeriodeDebut} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date Limite Paiement</label>
                <input type="date" value={formData.dateLimitePaiement || ''} onChange={(e) => setFormData({ ...formData, dateLimitePaiement: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Lignes du bordereau</label>
                <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1"><Plus size={14} /> Ajouter une ligne</Button>
              </div>
              <div className="border rounded-lg divide-y">
                {lines.map((line, i) => (
                  <div key={i} className="p-3 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Libellé</label>
                      <input value={line.libelle} onChange={(e) => updateLine(i, { libelle: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" required />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Prime Brute</label>
                      <input type="number" step="0.001" value={line.primeBrute ?? ''} onChange={(e) => updateLine(i, { primeBrute: e.target.value ? Number(e.target.value) : undefined })} className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Commission Cédante</label>
                      <input type="number" step="0.001" value={line.commissionCedante ?? ''} onChange={(e) => updateLine(i, { commissionCedante: e.target.value ? Number(e.target.value) : undefined })} className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Commission Courtage</label>
                      <input type="number" step="0.001" value={line.commissionCourtage ?? ''} onChange={(e) => updateLine(i, { commissionCourtage: e.target.value ? Number(e.target.value) : undefined })} className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Prime Nette</label>
                      <input type="number" step="0.001" value={line.primeNette ?? ''} onChange={(e) => updateLine(i, { primeNette: e.target.value ? Number(e.target.value) : undefined })} className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm">
                <span className="text-gray-600">Total (prime nette / brute) : </span>
                <span className="font-semibold">{totalPrimeNette.toLocaleString()} {formData.currency}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer les Modifications'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Annuler</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}