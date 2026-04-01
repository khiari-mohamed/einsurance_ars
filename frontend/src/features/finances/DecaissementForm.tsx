import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { financesApi } from '@/api/finances.api';
import { BeneficiaireType, ModePaiement } from '@/types/finance.types';
import { toast } from 'sonner';

interface DecaissementFormProps {
  decaissementId?: string;
  affaireId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function DecaissementForm({ decaissementId, affaireId, onSuccess, onCancel }: DecaissementFormProps) {
  const [loading, setLoading] = useState(false);
  const [reassureurs, setReassureurs] = useState<any[]>([]);
  const [selectedReassureur, setSelectedReassureur] = useState<any>(null);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<any>({
    defaultValues: {
      dateDecaissement: new Date().toISOString().split('T')[0],
      dateValeur: new Date().toISOString().split('T')[0],
      montant: 0,
      devise: 'TND',
      tauxChange: 1,
      fraisBancaires: 0,
      beneficiaireType: BeneficiaireType.REASSUREUR,
      modePaiement: ModePaiement.SWIFT,
      commissionARS: 0,
      affaireId: affaireId || '',
      reassureurId: '',
      banqueBeneficiaire: {},
      referenceSwift: '',
      notes: '',
    },
  });

  const beneficiaireType = watch('beneficiaireType');
  const montant = watch('montant');
  const tauxChange = watch('tauxChange');
  const fraisBancaires = watch('fraisBancaires');
  const commissionARS = watch('commissionARS');
  const devise = watch('devise');
  const reassureurId = watch('reassureurId');

  useEffect(() => {
    if (decaissementId) {
      loadDecaissement();
    }
    loadReassureurs();
  }, [decaissementId]);

  useEffect(() => {
    if (devise !== 'TND') {
      fetchExchangeRate(devise);
    } else {
      setValue('tauxChange', 1);
    }
  }, [devise]);

  useEffect(() => {
    if (reassureurId) {
      const reass = reassureurs.find(r => r.id === reassureurId);
      setSelectedReassureur(reass);
      if (reass?.banque) {
        setValue('banqueBeneficiaire', {
          nom: reass.banque.nom || '',
          swift: reass.banque.swift || '',
          iban: reass.banque.iban || '',
          adresse: reass.banque.adresse || '',
          pays: reass.banque.pays || '',
        });
      }
    }
  }, [reassureurId, reassureurs]);

  const loadDecaissement = async () => {
    try {
      const data = await financesApi.getDecaissement(decaissementId!);
      Object.keys(data).forEach((key) => {
        setValue(key as any, data[key as keyof typeof data]);
      });
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const loadReassureurs = async () => {
    try {
      const response = await fetch('/api/reassureurs');
      const data = await response.json();
      setReassureurs(data);
    } catch (error) {
      console.error('Error loading reassureurs:', error);
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
      if (decaissementId) {
        await financesApi.updateDecaissement(decaissementId, data);
        toast.success('Décaissement modifié avec succès');
      } else {
        await financesApi.createDecaissement(data);
        toast.success('Décaissement créé avec succès');
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const montantTND = Number(montant) * Number(tauxChange);
  const montantTotal = Number(montant) + Number(fraisBancaires);
  const montantNet = Number(montant) - Number(commissionARS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{decaissementId ? 'Modifier' : 'Nouveau'} Décaissement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date Décaissement *</Label>
              <Input type="date" {...register('dateDecaissement', { required: true })} />
              {errors.dateDecaissement && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Date Valeur *</Label>
              <Input type="date" {...register('dateValeur', { required: true })} />
              {errors.dateValeur && <span className="text-red-500 text-sm">Requis</span>}
            </div>

            <div>
              <Label>Type Bénéficiaire *</Label>
              <Select onValueChange={(v) => setValue('beneficiaireType', v as BeneficiaireType)} defaultValue={BeneficiaireType.REASSUREUR}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BeneficiaireType.REASSUREUR}>Réassureur</SelectItem>
                  <SelectItem value={BeneficiaireType.CEDANTE}>Cédante</SelectItem>
                  <SelectItem value={BeneficiaireType.COURTIER}>Courtier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {beneficiaireType === BeneficiaireType.REASSUREUR && (
              <div>
                <Label>Réassureur *</Label>
                <Select onValueChange={(v) => setValue('reassureurId', v)}>
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

            <div>
              <Label>Frais Bancaires</Label>
              <Input type="number" step="0.01" {...register('fraisBancaires')} />
            </div>

            <div>
              <Label>Commission ARS</Label>
              <Input type="number" step="0.01" {...register('commissionARS')} />
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm text-gray-600">Montant TND</p>
                <p className="text-lg font-semibold">{montantTND.toFixed(2)} TND</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Montant Total</p>
                <p className="text-lg font-semibold">{montantTotal.toFixed(2)} {devise}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Réassureur</p>
                <p className="text-lg font-semibold text-green-600">{montantNet.toFixed(2)} {devise}</p>
              </div>
            </div>

            <div>
              <Label>Mode de Paiement *</Label>
              <Select onValueChange={(v) => setValue('modePaiement', v as ModePaiement)} defaultValue={ModePaiement.SWIFT}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ModePaiement.SWIFT}>SWIFT</SelectItem>
                  <SelectItem value={ModePaiement.VIREMENT}>Virement Local</SelectItem>
                  <SelectItem value={ModePaiement.CHEQUE}>Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Référence SWIFT</Label>
              <Input {...register('referenceSwift')} />
            </div>

            {selectedReassureur && (
              <div className="col-span-2 p-4 bg-blue-50 rounded-md">
                <h4 className="font-semibold mb-2">Informations Bancaires</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Banque:</span> {selectedReassureur.banque?.nom}</div>
                  <div><span className="font-medium">SWIFT:</span> {selectedReassureur.banque?.swift}</div>
                  <div><span className="font-medium">IBAN:</span> {selectedReassureur.banque?.iban}</div>
                  <div><span className="font-medium">Pays:</span> {selectedReassureur.banque?.pays}</div>
                </div>
              </div>
            )}

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} />
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
