import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exchangeRateApi } from '@/api/slips';
import { toast } from 'sonner';

export default function ExchangeRates() {
  const queryClient = useQueryClient();
  const [convertData, setConvertData] = useState({ montant: 0, from: 'EUR', to: 'TND' });

  const { data: rates } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => Promise.all([
      exchangeRateApi.getLatest('EUR'),
      exchangeRateApi.getLatest('USD'),
      exchangeRateApi.getLatest('GBP'),
    ]),
  });

  const fetchBCT = useMutation({
    mutationFn: exchangeRateApi.fetchFromBCT,
    onSuccess: () => {
      toast.success('Taux BCT mis à jour');
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  const { data: conversion, refetch: convertAmount } = useQuery({
    queryKey: ['convert', convertData],
    queryFn: () => exchangeRateApi.convert(convertData.montant, convertData.from, convertData.to),
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Taux de Change</CardTitle>
            <Button onClick={() => fetchBCT.mutate()} disabled={fetchBCT.isPending}>
              {fetchBCT.isPending ? 'Mise à jour...' : 'Actualiser BCT'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {rates?.map((rate: any) => (
              <Card key={rate.devise}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold">{rate.devise}</h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">Achat: <span className="font-semibold">{rate.tauxAchat}</span></p>
                      <p className="text-sm">Vente: <span className="font-semibold">{rate.tauxVente}</span></p>
                      <p className="text-xs text-gray-500">{new Date(rate.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convertisseur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Input
              type="number"
              placeholder="Montant"
              value={convertData.montant}
              onChange={(e) => setConvertData({ ...convertData, montant: parseFloat(e.target.value) })}
            />
            <select
              value={convertData.from}
              onChange={(e) => setConvertData({ ...convertData, from: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="TND">TND</option>
            </select>
            <select
              value={convertData.to}
              onChange={(e) => setConvertData({ ...convertData, to: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
            <Button onClick={() => convertAmount()}>Convertir</Button>
          </div>
          {conversion && (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="text-lg font-semibold">
                {convertData.montant} {convertData.from} = {conversion.montantConverti} {convertData.to}
              </p>
              <p className="text-sm text-gray-600">Taux: {conversion.tauxUtilise}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
