import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { financesApi } from '@/api/finances.api';
import { SourceType, ModePaiement } from '@/types/finance.types';
import { toast } from 'sonner';

interface EncaissementFormData {
  dateEncaissement: string;
  montant: number;
  devise: string;
  tauxChange: number;
  sourceType: SourceType;
  modePaiement: ModePaiement;
  referencePaiement: string;
  affaireId: string;
  cedanteId?: string;
  reassureurId?: string;
  banqueEmettrice?: string;
  compteBancaireId?: string;
  notes?: string;
}

interface EncaissementFormProps {
  encaissementId?: string;
  affaireId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function EncaissementForm({ encaissementId, affaireId, onSuccess, onCancel }: EncaissementFormProps) {
  const [loading, setLoading] = useState(false);
  const [cedantes, setCedantes] = useState<any[]>([]);
  const [reassureurs, setReassureurs] = useState<any[]>([]);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EncaissementFormData>({
    defaultValues: {
      dateEncaissement: new Date().toISOString().split('T')[0],
      montant: 0,
      devise: 'TND',
      tauxChange: 1,
      sourceType: SourceType.CEDANTE,
      modePaiement: ModePaiement.VIREMENT,
      referencePaiement: '',
      affaireId: affaireId || '',
    },
  });

  const sourceType = watch('sourceType');
  const montant = watch('montant');
  const tauxChange = watch('tauxChange');
  const devise = watch('devise');

  useEffect(() => {
    if (encaissementId) {
      loadEncaissement();
    }
    loadReferenceData();
  }, [encaissementId]);

  useEffect(() => {
    if (devise !== 'TND') {
      fetchExchangeRate(devise);
    } else {
      setValue('tauxChange', 1);
    }
  }, [devise]);

  const loadEncaissement = async () => {
    try {
      const data = await financesApi.getEncaissement(encaissementId!);
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
        fetch('/api/cedantes').then(r => r.json()),
        fetch('/api/reassureurs').then(r => r.json()),
      ]);
      setCedantes(cedantesRes);
      setReassureurs(reassureursRes);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const fetchExchangeRate = async (currency: string) => {
    try {
      const response = await fetch(`/api/system/exchange-rates?devise=${currency}`);
      const data = await response.json();
      setValue('tauxChange', data.taux || 1);
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (encaissementId) {
        await financesApi.updateEncaissement(encaissementId, data);
        toast.success('Encaissement modifié avec succès');
      } else {
        await financesApi.createEncaissement(data);
        toast.success('Encaissement créé avec succès');
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const montantTND = Number(montant) * Number(tauxChange);

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
              <Input
                type="number"
                step="0.01"
                {...register('montant', { required: true, min: 0 })}
              />
              {errors.montant && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Devise *</Label>
              <Select onValueChange={(v) => setValue('devise', v)} defaultValue="TND">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">TND</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Taux de Change</Label>
              <Input
                type="number"
                step="0.000001"
                {...register('tauxChange')}
                readOnly={devise === 'TND'}
              />
            </div>

            {devise !== 'TND' && (
              <div className="col-span-2">
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm font-medium">
                    Montant équivalent TND: <span className="text-lg">{montantTND.toFixed(2)} TND</span>
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label>Source *</Label>
              <Select onValueChange={(v) => setValue('sourceType', v as SourceType)} defaultValue={SourceType.CEDANTE}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SourceType.CEDANTE}>Cédante</SelectItem>
                  <SelectItem value={SourceType.CLIENT}>Client</SelectItem>
                  <SelectItem value={SourceType.REASSUREUR}>Réassureur</SelectItem>
                  <SelectItem value={SourceType.COURTIER}>Courtier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === SourceType.CEDANTE && (
              <div>
                <Label>Cédante *</Label>
                <Select onValueChange={(v) => setValue('cedanteId', v as any)}>
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
              </div>
            )}

            {sourceType === SourceType.REASSUREUR && (
              <div>
                <Label>Réassureur *</Label>
                <Select onValueChange={(v) => setValue('reassureurId', v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reassureurs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Mode de Paiement *</Label>
              <Select onValueChange={(v) => setValue('modePaiement', v as ModePaiement)} defaultValue={ModePaiement.VIREMENT}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ModePaiement.VIREMENT}>Virement</SelectItem>
                  <SelectItem value={ModePaiement.CHEQUE}>Chèque</SelectItem>
                  <SelectItem value={ModePaiement.EFFET}>Effet</SelectItem>
                  <SelectItem value={ModePaiement.CASH}>Cash</SelectItem>
                  <SelectItem value={ModePaiement.SWIFT}>SWIFT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Référence Paiement *</Label>
              <Input {...register('referencePaiement', { required: true })} placeholder="N° virement, chèque..." />
              {errors.referencePaiement && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Banque Émettrice</Label>
              <Input {...register('banqueEmettrice' as any)} />
            </div>

            <div>
              <Label>Compte Bancaire</Label>
              <Input {...register('compteBancaireId' as any)} placeholder="512xxxxx" />
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea {...register('notes' as any)} rows={3} />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
