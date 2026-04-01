import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { financesApi } from '@/api/finances.api';
import { Settlement } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

interface SettlementDetailsProps {
  settlementId: string;
}

export default function SettlementDetails({ settlementId }: SettlementDetailsProps) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    loadSettlement();
  }, [settlementId]);

  const loadSettlement = async () => {
    try {
      const data = await financesApi.getSettlement(settlementId);
      setSettlement(data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  if (!settlement) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card>
        <CardHeader>
          <CardTitle>Situation {settlement.numero}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Cédante</p>
              <p className="font-semibold">{settlement.cedante?.nom}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Période</p>
              <p className="font-semibold">
                {formatDate(settlement.dateDebut)} - {formatDate(settlement.dateFin)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-semibold">{settlement.type.toUpperCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Financier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Prime</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(settlement.totalPrime)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Commission ARS</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(settlement.totalCommissionARS)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Commission Cédante</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(settlement.totalCommissionCedante)}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Solde Final</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(settlement.soldeFinal)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Sinistres</p>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(settlement.totalSinistre)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Solde Précédent</p>
              <p className="text-lg font-semibold">
                {formatCurrency(settlement.soldePrecedent)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gain/Perte de Change</p>
              <p className={`text-lg font-semibold ${Number(settlement.gainPerteChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(settlement.gainPerteChange)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des Affaires ({settlement.lignes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bordereau</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prime 100%</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prime Cédée</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comm. ARS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sinistres</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net à Payer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {settlement.lignes.map((ligne, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{ligne.referenceBordereau}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{ligne.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(ligne.prime100)}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(ligne.primeCedee)}</td>
                    <td className="px-4 py-3 text-sm text-purple-600">{formatCurrency(ligne.commissionARS)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(ligne.sinistreMontant)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(ligne.netAPayer)}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        ligne.statutPaiement === 'PAYE' ? 'bg-green-500' :
                        ligne.statutPaiement === 'PARTIEL' ? 'bg-yellow-500' : 'bg-red-500'
                      }>
                        {ligne.statutPaiement}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {settlement.historique && settlement.historique.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {settlement.historique.map((h, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{h.action}</p>
                    {h.details && <p className="text-sm text-gray-600">{h.details}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{formatDate(h.date)}</p>
                    <p className="text-xs text-gray-500">{h.user}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
