import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { financesApi } from '@/api/finances.api';
import masterDataApi from '@/api/master-data.api';
import affairesApi from '@/api/affaires.api';
import { FinancialPartyType, partyTypeLabels, CreateDecaissementInput } from '@/types/finance.types';
import { toast } from 'sonner';

const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP'];

interface Props {
  decaissementId?: string;
  affaireId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// FIX (Finances pass): full rewrite. Real Decaissement has no `dateValeur`,
// `fraisBancaires`, `banqueBeneficiaire` object, `commissionARS`,
// `referenceSwift` fields — those belong to (or are derived from) the
// affaire/OrdrePaiement, not entered manually here. reassureurCode (not
// reassureurId — the schema denormalizes the reinsurer's `code` directly
// onto Decaissement).
export default function DecaissementForm({ decaissementId, affaireId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, reset, formState: { errors } } = useForm<CreateDecaissementInput>({
    defaultValues: {
      partyType: FinancialPartyType.REASSUREUR,
      montant: 0,
      currency: 'TND',
      affaireId: affaireId || undefined,
    },
  });

  const partyType = watch('partyType');
  const currency = watch('currency');

  const { data: reassureurs = [] } = useQuery({
    queryKey: ['reassureurs-lite'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll({ limit: 500 })).data.data,
  });
  const { data: coCourtiers = [] } = useQuery({
    queryKey: ['co-courtiers-lite'],
    queryFn: async () => (await masterDataApi.coCourtiers.getAll({ limit: 500 })).data.data,
  });
  const { data: affaires = [] } = useQuery({
    queryKey: ['affaires-lite'],
    queryFn: async () => (await affairesApi.getAll({ limit: 100 })).data.data,
  });

  useEffect(() => {
    if (decaissementId) {
      financesApi.getDecaissement(decaissementId).then(({ data }) => {
        reset({
          affaireId: data.affaireId,
          partyType: data.partyType,
          reassureurCode: data.reassureurCode,
          coCourtId: data.coCourtId,
          montant: data.montant,
          currency: data.currency,
          tauxReglement: data.tauxReglement,
          description: data.description,
          stepNumber: data.stepNumber,
        });
      });
    }
  }, [decaissementId, reset]);

  const onSubmit = async (data: CreateDecaissementInput) => {
    setLoading(true);
    try {
      if (decaissementId) {
        await financesApi.updateDecaissement(decaissementId, data);
        toast.success('Décaissement modifié avec succès');
      } else {
        const { data: created } = await financesApi.createDecaissement(data);
        toast.success('Décaissement créé avec succès (brouillon)');
        if ((created as any).amlFlagged) {
          toast.warning((created as any).amlReason || 'Transaction signalée pour revue AML');
        }
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{decaissementId ? 'Modifier' : 'Nouveau'} Décaissement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bénéficiaire *</Label>
              <Controller
                name="partyType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FinancialPartyType.REASSUREUR}>{partyTypeLabels[FinancialPartyType.REASSUREUR]}</SelectItem>
                      <SelectItem value={FinancialPartyType.CEDANTE}>{partyTypeLabels[FinancialPartyType.CEDANTE]}</SelectItem>
                      <SelectItem value={FinancialPartyType.CO_COURTIER}>{partyTypeLabels[FinancialPartyType.CO_COURTIER]}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {partyType === FinancialPartyType.REASSUREUR && (
              <div>
                <Label>Réassureur *</Label>
                <Controller
                  name="reassureurCode"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {reassureurs.map((r: any) => <SelectItem key={r.id} value={r.code}>{r.raisonSociale} ({r.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {partyType === FinancialPartyType.CO_COURTIER && (
              <div>
                <Label>Co-Courtier *</Label>
                <Controller
                  name="coCourtId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {coCourtiers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.raisonSociale}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div>
              <Label>Montant *</Label>
              <Input type="number" step="0.001" {...register('montant', { required: true, min: 0, valueAsNumber: true })} />
              {errors.montant && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Devise *</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <Label>Taux de règlement {currency !== 'TND' && <span className="text-gray-400 text-xs">(optionnel — auto BCT si vide)</span>}</Label>
              <Input type="number" step="0.000001" {...register('tauxReglement', { valueAsNumber: true })} disabled={currency === 'TND'} placeholder={currency === 'TND' ? '1' : 'Auto'} />
            </div>

            <div className="col-span-2">
              <Label>Affaire liée (optionnel)</Label>
              <Controller
                name="affaireId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      {affaires.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.numero}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} />
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Créé au statut Brouillon — l'approbation, l'exécution et le rattachement à un ordre de virement se font depuis la liste des décaissements.
          </p>

          <div className="flex gap-2 justify-end">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
            <Button type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}