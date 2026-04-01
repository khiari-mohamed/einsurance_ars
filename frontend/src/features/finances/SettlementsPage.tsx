import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, CheckCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { Settlement, SettlementStatus, SettlementType } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import SettlementForm from './SettlementForm';
import SettlementDetails from './SettlementDetails';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    loadSettlements();
  }, []);

  const loadSettlements = async () => {
    try {
      const response = await financesApi.getSettlements();
      setSettlements(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const handleCalculate = async (id: string) => {
    try {
      await financesApi.calculateSettlement(id);
      toast.success('Situation calculée avec succès');
      loadSettlements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleValidate = async (id: string) => {
    try {
      await financesApi.validateSettlement(id);
      toast.success('Situation validée avec succès');
      loadSettlements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const getStatusBadge = (statut: SettlementStatus) => {
    const colors = {
      [SettlementStatus.EN_COURS]: 'bg-gray-500',
      [SettlementStatus.CALCULEE]: 'bg-blue-500',
      [SettlementStatus.VALIDEE]: 'bg-green-500',
      [SettlementStatus.ENVOYEE]: 'bg-purple-500',
      [SettlementStatus.REGLEE]: 'bg-emerald-600',
      [SettlementStatus.ANNULEE]: 'bg-red-500',
    };
    return <Badge className={colors[statut]}>{statut.toUpperCase()}</Badge>;
  };

  const getTypeBadge = (type: SettlementType) => {
    const labels = {
      [SettlementType.MENSUELLE]: 'Mensuelle',
      [SettlementType.TRIMESTRIELLE]: 'Trimestrielle',
      [SettlementType.SEMESTRIELLE]: 'Semestrielle',
      [SettlementType.ANNUELLE]: 'Annuelle',
    };
    return <Badge variant="outline">{labels[type]}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Situations de Règlement</h1>
        <Button onClick={() => { setSelectedId(undefined); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle Situation
        </Button>
      </div>

      {/* Settlements Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédante</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Prime</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde Final</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{settlement.numero}</td>
                    <td className="px-4 py-3">{getTypeBadge(settlement.type)}</td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(settlement.dateDebut)} - {formatDate(settlement.dateFin)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {settlement.cedante?.nom || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatCurrency(settlement.totalPrime)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-purple-600">
                      {formatCurrency(settlement.totalCommissionARS)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">
                      {formatCurrency(settlement.soldeFinal)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(settlement.statut)}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedId(settlement.id); setShowDetails(true); }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      {settlement.statut === SettlementStatus.EN_COURS && (
                        <Button size="sm" onClick={() => handleCalculate(settlement.id)}>
                          Calculer
                        </Button>
                      )}
                      {settlement.statut === SettlementStatus.CALCULEE && (
                        <Button size="sm" onClick={() => handleValidate(settlement.id)}>
                          <CheckCircle className="mr-1 h-4 w-4" /> Valider
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Situation</DialogTitle>
          </DialogHeader>
          <SettlementForm
            onSuccess={() => { setShowForm(false); loadSettlements(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la Situation</DialogTitle>
          </DialogHeader>
          {selectedId && <SettlementDetails settlementId={selectedId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
