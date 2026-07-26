import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financesApi } from '@/api/finances.api';
import affairesApi from '@/api/affaires.api';
import { SettlementMode, CreateSettlementInput } from '@/types/finance.types';
import { toast } from 'sonner';

interface Props { onSuccess?: () => void; onCancel?: () => void }

// FIX (Finances pass): full rewrite. Real Settlement is a simple
// reconciliation record — mode (PAR_AFFAIRE/PAR_SITUATION), a single
// montant, and FX rates. It has no cedanteId/type/dateDebut/dateFin — those
// belong to Situation, not Settlement. Deliberately scoped to PAR_AFFAIRE
// here (a standalone settlement not tied to a compiled situation); a
// PAR_SITUATION settlement is created from within SituationsPage's detail
// view once that reviewed workflow exists.
export default function SettlementForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, control } = useForm<CreateSettlementInput>({
    defaultValues: { mode: SettlementMode.PAR_AFFAIRE, montant: 0, currency: 'TND', dateSettlement: new Date().toISOString().split('T')[0] },
  });

  const currency = watch('currency');

  const { data: affaires = [] } = useQuery({
    queryKey: ['affaires-lite'],
    queryFn: async () => (await affairesApi.getAll({ limit: 100 })).data.data,
  });

  const onSubmit = async (data: CreateSettlementInput) => {
    setLoading(true);
    try {
      await financesApi.createSettlement(data);
      toast.success('Règlement créé avec succès');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Affaire *</Label>
              <Controller
                name="affaireId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {affaires.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.numero}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Date de règlement *</Label>
              <Input type="date" {...register('dateSettlement', { required: true })} />
            </div>
            <div>
              <Label>Montant *</Label>
              <Input type="number" step="0.001" {...register('montant', { required: true, min: 0, valueAsNumber: true })} />
            </div>
            <div>
              <Label>Devise *</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['TND', 'EUR', 'USD', 'GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>
            {currency !== 'TND' && (
              <>
                <div>
                  <Label>Taux de réalisation</Label>
                  <Input type="number" step="0.000001" {...register('tauxRealisation', { valueAsNumber: true })} placeholder="Auto BCT si vide" />
                </div>
                <div>
                  <Label>Taux de règlement</Label>
                  <Input type="number" step="0.000001" {...register('tauxReglement', { valueAsNumber: true })} placeholder="Auto BCT si vide" />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
            <Button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}