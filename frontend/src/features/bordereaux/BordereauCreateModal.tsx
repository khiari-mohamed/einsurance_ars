import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import affairesApi from '../../api/affaires.api';
import { AffaireStatut } from '../../types/affaire.types';
import type { Bordereau, BordereauType, BordereauLine, CreateBordereauDto, BordereauDocumentType } from '../../types/bordereau.types';
import BordereauDocuments from './BordereauDocuments';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import CurrencySelect from '../../components/ui/CurrencySelect';
import masterDataApi from '../../api/master-data.api';

interface Props { isOpen: boolean; onClose: () => void }

const BORDEREAU_TYPES: { value: BordereauType; label: string }[] = [
  { value: 'CESSION_CEDANTE', label: 'Cession Cédante' },
  { value: 'CESSION_REASSUREUR', label: 'Cession Réassureur' },
  { value: 'SINISTRE_FACULTATIVE', label: 'Sinistre Facultative' },
  { value: 'SITUATION_TRAITE', label: 'Situation Traité' },
  { value: 'FACTURE_DEPOT_PRIME', label: 'Facture Dépôt Prime' },
  { value: 'NOTE_DE_CREDIT', label: 'Note de Crédit' },
  { value: 'ETAT_DE_TRANSFERT', label: 'État de Transfert' },
  { value: 'SITUATION_FINANCIERE', label: 'Situation Financière' },
  { value: 'FACTURE_PRIME_REASSURANCE_DEPOT', label: 'Facture Prime Réassurance (Dépôt)' },
  { value: 'FACTURE_PRIME_REASSURANCE_AJUSTEMENT', label: 'Facture Prime Réassurance (Ajustement)' },
];

// NEW — mirrors bordereaux.service.ts's TRAITE_TYPES set. Types whose lines
// need the DEBIT/CREDIT column set instead of the flat cession columns.
const TRAITE_TYPES: BordereauType[] = [
  'SITUATION_TRAITE', 'FACTURE_DEPOT_PRIME', 'NOTE_DE_CREDIT', 'ETAT_DE_TRANSFERT',
  'SITUATION_FINANCIERE', 'FACTURE_PRIME_REASSURANCE_DEPOT', 'FACTURE_PRIME_REASSURANCE_AJUSTEMENT',
];
const isTraiteType = (t: BordereauType) => TRAITE_TYPES.includes(t);

const emptyLine = (): BordereauLine => ({ libelle: '', ordre: 0 });

const DOCUMENT_TYPES: { value: BordereauDocumentType; label: string }[] = [
  { value: 'swift_confirmation', label: 'Confirmation SWIFT' },
  { value: 'bank_statement', label: 'Relevé Bancaire' },
  { value: 'payment_justification', label: 'Justificatif de Paiement' },
  { value: 'settlement_statement', label: 'État de Règlement' },
  { value: 'bordereau_signe', label: 'Bordereau contresigné' },
  { value: 'correspondence', label: 'Correspondance' },
  { value: 'other', label: 'Autre' },
];

// NEW — display-only mirror of BordereauxService.computeMontant(), so the
// running total shown in the modal matches what the backend will actually
// store once submitted.
function computeDisplayTotal(type: BordereauType, lines: BordereauLine[]): number {
  if (type === 'SINISTRE_FACULTATIVE') {
    return lines.reduce((s, l) => s + (l.sinistresPayes ?? l.primeNette ?? l.primeBrute ?? 0), 0);
  }
  if (isTraiteType(type)) {
    let credit = 0, debit = 0, fallback = 0;
    for (const l of lines) {
      const c = (l.primesCedees ?? 0) + (l.recLiberes ?? 0) + (l.sapLiberes ?? 0) + (l.interets ?? 0);
      const d = (l.sinistresPayes ?? 0) + (l.recConstitues ?? 0) + (l.sapConstitues ?? 0)
        + (l.participationsBenef ?? 0) + (l.taxes ?? 0) + (l.brokerage ?? 0)
        + (l.commissionCedante ?? 0) + (l.commissionCourtage ?? 0);
      if (c === 0 && d === 0) fallback += (l.primeNette ?? l.primeBrute ?? 0);
      else { credit += c; debit += d; }
    }
    return Math.abs(credit - debit) + Math.abs(fallback);
  }
  return lines.reduce((s, l) => s + (l.primeNette ?? l.primeBrute ?? 0), 0);
}

export default function BordereauCreateModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateBordereauDto>({
    type: 'CESSION_CEDANTE',
    currency: 'TND',
    notes: '',
  });
  const [lines, setLines] = useState<BordereauLine[]>([emptyLine()]);
  const [createdBordereau, setCreatedBordereau] = useState<Bordereau | null>(null);
  const [uploadData, setUploadData] = useState<{ file: File | null; type: BordereauDocumentType; description: string }>({
    file: null,
    type: 'payment_justification',
    description: '',
  });

  const { data: cedantes } = useQuery({
    queryKey: ['cedantes'],
    queryFn: async () => (await masterDataApi.cedantes.getAll()).data,
  });

  const { data: affaires } = useQuery({
    queryKey: ['affaires', { statut: AffaireStatut.PLACEMENT_REALISE, limit: 200 }],
    queryFn: () => affairesApi.getAll({ statut: AffaireStatut.PLACEMENT_REALISE, limit: 200 }),
  });

  const { data: reassureurs } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll()).data,
    enabled: formData.type === 'CESSION_REASSUREUR' || formData.type === 'ETAT_DE_TRANSFERT',
  });

  const displayTotal = computeDisplayTotal(formData.type, lines);
  const traite = isTraiteType(formData.type);

  const createMutation = useMutation({
    mutationFn: async (data: CreateBordereauDto) => {
      const result = await bordereauxApi.create(data);
      const created = (result as any)?.data ?? result as any;
      if (uploadData.file) {
        await bordereauxApi.uploadDocument(created.id, uploadData.file, uploadData.type, uploadData.description || undefined);
      }
      return created;
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      setCreatedBordereau(created);
    },
  });

  const resetForm = () => {
    setFormData({ type: 'CESSION_CEDANTE', currency: 'TND', notes: '' });
    setLines([emptyLine()]);
    setCreatedBordereau(null);
    setUploadData({ file: null, type: 'payment_justification', description: '' });
  };

  const updateLine = (index: number, patch: Partial<BordereauLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const numField = (v: string) => (v ? Number(v) : undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lines.some((l) => l.libelle.trim())) {
      alert('Veuillez renseigner au moins une ligne avec un libellé');
      return;
    }
    if (formData.type === 'CESSION_REASSUREUR' && !formData.reassureurCode) {
      alert('Veuillez sélectionner un réassureur');
      return;
    }
    createMutation.mutate({
      ...formData,
      lines: lines.filter((l) => l.libelle.trim()).map((l, i) => ({ ...l, ordre: i + 1 })),
    });
  };

  if (!isOpen) return null;

  const needsCedante = formData.type !== 'CESSION_REASSUREUR' && formData.type !== 'ETAT_DE_TRANSFERT';
  const needsReassureur = formData.type === 'CESSION_REASSUREUR' || formData.type === 'ETAT_DE_TRANSFERT';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Créer un Bordereau</h2>
            <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Type de Bordereau <span className="text-red-500">*</span></label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as BordereauType })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {BORDEREAU_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

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

              <div>
                <label className="block text-sm font-medium mb-2">Affaire</label>
                <select
                  value={formData.affaireId || ''}
                  onChange={(e) => setFormData({ ...formData, affaireId: e.target.value || undefined })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">— Aucune —</option>
                  {affaires?.data?.data?.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.numero} — {a.cedante?.raisonSociale ?? a.cedanteId}</option>
                  ))}
                </select>
              </div>

              {needsReassureur && (
                <div>
                  <label className="block text-sm font-medium mb-2">Réassureur <span className="text-red-500">*</span></label>
                  <select
                    value={formData.reassureurCode || ''}
                    onChange={(e) => setFormData({ ...formData, reassureurCode: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
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
                <CurrencySelect value={formData.currency ?? 'TND'} onChange={(value) => setFormData({ ...formData, currency: value })} />
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
                <p className="text-xs text-gray-500 mt-1">Par défaut : +30 jours à l'envoi, si non renseigné</p>
              </div>
            </div>

            {/* Lines editor */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Lignes du bordereau</label>
                <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1"><Plus size={14} /> Ajouter une ligne</Button>
              </div>
              <div className="border rounded-lg divide-y">
                {lines.map((line, i) => (
                  <div key={i} className="p-3">
                    {!traite ? (
                      // ── Cession columns (CESSION_CEDANTE / CESSION_REASSUREUR / SINISTRE_FACULTATIVE) ──
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">Libellé</label>
                          <input value={line.libelle} onChange={(e) => updateLine(i, { libelle: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" required />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Prime Brute</label>
                          <input type="number" step="0.001" value={line.primeBrute ?? ''} onChange={(e) => updateLine(i, { primeBrute: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Commission Cédante</label>
                          <input type="number" step="0.001" value={line.commissionCedante ?? ''} onChange={(e) => updateLine(i, { commissionCedante: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Commission Courtage</label>
                          <input type="number" step="0.001" value={line.commissionCourtage ?? ''} onChange={(e) => updateLine(i, { commissionCourtage: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Prime Nette</label>
                          <input type="number" step="0.001" value={line.primeNette ?? ''} onChange={(e) => updateLine(i, { primeNette: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // ── Traité DEBIT/CREDIT columns (7 traité-family types) ──
                      <div>
                        <div className="grid grid-cols-12 gap-2 items-end mb-2">
                          <div className="col-span-5">
                            <label className="text-xs text-gray-500">Libellé</label>
                            <input value={line.libelle} onChange={(e) => updateLine(i, { libelle: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" required />
                          </div>
                          <div className="col-span-6">
                            <label className="text-xs text-gray-500">Couverture</label>
                            <input value={line.couverture ?? ''} onChange={(e) => updateLine(i, { couverture: e.target.value || undefined })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                              <Trash2 size={14} className="text-red-500" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-red-700 mb-1">Débit</div>
                        <div className="grid grid-cols-6 gap-2 mb-3">
                          <div>
                            <label className="text-xs text-gray-500">Sinistres Payés</label>
                            <input type="number" step="0.001" value={line.sinistresPayes ?? ''} onChange={(e) => updateLine(i, { sinistresPayes: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">REC Constituées</label>
                            <input type="number" step="0.001" value={line.recConstitues ?? ''} onChange={(e) => updateLine(i, { recConstitues: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">SAP Constitués</label>
                            <input type="number" step="0.001" value={line.sapConstitues ?? ''} onChange={(e) => updateLine(i, { sapConstitues: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Part. Bénéf.</label>
                            <input type="number" step="0.001" value={line.participationsBenef ?? ''} onChange={(e) => updateLine(i, { participationsBenef: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Taxes</label>
                            <input type="number" step="0.001" value={line.taxes ?? ''} onChange={(e) => updateLine(i, { taxes: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Courtage</label>
                            <input type="number" step="0.001" value={line.brokerage ?? ''} onChange={(e) => updateLine(i, { brokerage: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-green-700 mb-1">Crédit</div>
                        <div className="grid grid-cols-6 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Primes Cédées</label>
                            <input type="number" step="0.001" value={line.primesCedees ?? ''} onChange={(e) => updateLine(i, { primesCedees: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">REC Libérés</label>
                            <input type="number" step="0.001" value={line.recLiberes ?? ''} onChange={(e) => updateLine(i, { recLiberes: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">SAP Libérés</label>
                            <input type="number" step="0.001" value={line.sapLiberes ?? ''} onChange={(e) => updateLine(i, { sapLiberes: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Intérêts</label>
                            <input type="number" step="0.001" value={line.interets ?? ''} onChange={(e) => updateLine(i, { interets: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Prime Brute</label>
                            <input type="number" step="0.001" value={line.primeBrute ?? ''} onChange={(e) => updateLine(i, { primeBrute: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Prime Nette</label>
                            <input type="number" step="0.001" value={line.primeNette ?? ''} onChange={(e) => updateLine(i, { primeNette: numField(e.target.value) })} className="w-full border rounded px-2 py-1 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm">
                <span className="text-gray-600">Total {traite ? '(solde net |débit − crédit|)' : '(prime nette / brute)'} : </span>
                <span className="font-semibold">{displayTotal.toLocaleString()} {formData.currency}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-sm font-medium mb-2">Document attaché (optionnel)</label>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-1">
                    <input type="file" onChange={(e) => setUploadData({ ...uploadData, file: e.target.files?.[0] ?? null })} className="block w-full text-sm text-gray-700 border rounded-lg cursor-pointer bg-white" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500">Type de document</label>
                    <select value={uploadData.type} onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as BordereauDocumentType })} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500">Description</label>
                    <input type="text" value={uploadData.description} onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Facultatif" />
                  </div>
                </div>
                {uploadData.file && <p className="text-sm text-gray-600 mt-2">Fichier sélectionné: {uploadData.file.name}</p>}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Création...' : 'Créer le Bordereau'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }} disabled={createMutation.isPending}>Annuler</Button>
            </div>
          </form>

          {createdBordereau && (
            <div className="space-y-4 mt-6">
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-green-700">Bordereau créé avec succès</p>
                    <p className="font-semibold text-gray-900">{createdBordereau.numero}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { onClose(); resetForm(); }}>
                    Fermer
                  </Button>
                </div>
              </Card>

              <BordereauDocuments bordereauId={createdBordereau.id} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}