import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financesApi } from '@/api/finances.api';
import { SettlementType } from '@/types/finance.types';
import { toast } from 'sonner';
import api from '@/lib/api';

interface SettlementFormProps {
  settlementId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SettlementForm({ settlementId, onSuccess, onCancel }: SettlementFormProps) {
  const [loading, setLoading] = useState(false);
  const [cedantes, setCedantes] = useState<any[]>([]);
  const [reassureurs, setReassureurs] = useState<any[]>([]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      type: SettlementType.TRIMESTRIELLE,
      dateDebut: '',
      dateFin: '',
      cedanteId: '',
      reassureurId: '',
    },
  });

  useEffect(() => {
    loadReferenceData();
    if (settlementId) {
      loadSettlement();
    }
  }, [settlementId]);

  const loadSettlement = async () => {
    try {
      const data = await financesApi.getSettlement(settlementId!);
      Object.keys(data).forEach((key) => {
        setValue(key as any, data[key as keyof typeof data]);
      });
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const loadReferenceData = async () => {
    try {
      const [cedantesRes, reassureursRes] = await Promise.all([
        api.get('/cedantes'),
        api.get('/reassureurs'),
      ]);
      setCedantes(cedantesRes.data);
      setReassureurs(reassureursRes.data);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await financesApi.createSettlement(data);
      toast.success('Situation créée avec succès');
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
              <Label>Type de Situation *</Label>
              <Select onValueChange={(v) => setValue('type', v as SettlementType)} defaultValue={SettlementType.TRIMESTRIELLE}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SettlementType.MENSUELLE}>Mensuelle</SelectItem>
                  <SelectItem value={SettlementType.TRIMESTRIELLE}>Trimestrielle</SelectItem>
                  <SelectItem value={SettlementType.SEMESTRIELLE}>Semestrielle</SelectItem>
                  <SelectItem value={SettlementType.ANNUELLE}>Annuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cédante *</Label>
              <Select onValueChange={(v) => setValue('cedanteId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {cedantes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cedanteId && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Date Début *</Label>
              <Input type="date" {...register('dateDebut', { required: true })} />
              {errors.dateDebut && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Date Fin *</Label>
              <Input type="date" {...register('dateFin', { required: true })} />
              {errors.dateFin && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Réassureur (optionnel)</Label>
              <Select onValueChange={(v) => setValue('reassureurId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les réassureurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {reassureurs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer Situation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
