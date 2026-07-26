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
import { FinancialPartyType, partyTypeLabels, CreateEncaissementInput } from '@/types/finance.types';
import { toast } from 'sonner';

const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP'];

interface Props {
  encaissementId?: string;
  affaireId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// FIX (Finances pass): full rewrite. Real Encaissement has no `numero`
// (it's `reference`, server-generated), no `banqueEmettrice`/
// `compteBancaireId` free fields, no `client`/`courtier` party — only
// FinancialPartyType (ASSURE/CEDANTE/REASSUREUR/CO_COURTIER/BANQUE_ARS).
// The old form also hand-rolled exchange-rate lookups via a nonexistent
// '/api/system/exchange-rates' route — removed entirely: the backend's
// ExchangeRateResolverService now resolves the BCT rate automatically from
// the Référentiel when `tauxRealisation` is left blank, and throws a clear
// error if none exists, rather than silently defaulting to 1.
export default function EncaissementForm({ encaissementId, affaireId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, reset, formState: { errors } } = useForm<CreateEncaissementInput>({
    defaultValues: {
      partyType: FinancialPartyType.CEDANTE,
      montant: 0,
      currency: 'TND',
      dateEncaissement: new Date().toISOString().split('T')[0],
      affaireId: affaireId || undefined,
    },
  });

  const partyType = watch('partyType');
  const currency = watch('currency');

  const { data: cedantes = [] } = useQuery({
    queryKey: ['cedantes-lite'],
    queryFn: async () => (await masterDataApi.cedantes.getAll({ limit: 500 })).data.data,
  });
  const { data: affaires = [] } = useQuery({
    queryKey: ['affaires-lite'],
    queryFn: async () => (await affairesApi.getAll({ limit: 100 })).data.data,
  });

  useEffect(() => {
    if (encaissementId) {
      financesApi.getEncaissement(encaissementId).then(({ data }) => {
        const values: CreateEncaissementInput = {
          affaireId: data.affaireId,
          partyType: data.partyType,
          cedanteId: data.cedanteId,
          assureLabel: data.assureLabel,
          montant: data.montant,
          currency: data.currency,
          tauxRealisation: data.tauxRealisation,
          dateEncaissement: data.dateEncaissement?.split('T')[0],
          description: data.description,
          stepNumber: data.stepNumber,
        };
        reset(values);
      });
    }
  }, [encaissementId, reset]);

  const onSubmit = async (data: CreateEncaissementInput) => {
    setLoading(true);
    try {
      if (encaissementId) {
        await financesApi.updateEncaissement(encaissementId, data);
        toast.success('Encaissement modifié avec succès');
      } else {
        const { data: created } = await financesApi.createEncaissement(data);
        toast.success('Encaissement créé avec succès');
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
        <CardTitle>{encaissementId ? 'Modifier' : 'Nouveau'} Encaissement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date Encaissement *</Label>
              <Input type="date" {...register('dateEncaissement', { required: true })} />
              {errors.dateEncaissement && <span className="text-red-500 text-sm">Requis</span>}
            </div>

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
              <Label>Taux de réalisation {currency !== 'TND' && <span className="text-gray-400 text-xs">(optionnel — résolu depuis le référentiel BCT si vide)</span>}</Label>
              <Input type="number" step="0.000001" {...register('tauxRealisation', { valueAsNumber: true })} disabled={currency === 'TND'} placeholder={currency === 'TND' ? '1' : 'Auto'} />
            </div>

            <div>
              <Label>Partie versante *</Label>
              <Controller
                name="partyType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(partyTypeLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {partyType === FinancialPartyType.CEDANTE && (
              <div>
                <Label>Cédante</Label>
                <Controller
                  name="cedanteId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {cedantes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.raisonSociale}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {partyType === FinancialPartyType.ASSURE && (
              <div>
                <Label>Assuré (libellé libre)</Label>
                <Input {...register('assureLabel')} placeholder="Raison sociale de l'assuré" />
              </div>
            )}

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
              <p className="text-[11px] text-gray-400 mt-1">Liste limitée aux 100 affaires les plus récentes.</p>
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
            <Button type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}