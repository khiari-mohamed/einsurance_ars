import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle, Download, AlertCircle, Send } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { OrdrePaiement, PaymentOrderStatus } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PaymentOrdersPage() {
  const [orders, setOrders] = useState<OrdrePaiement[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrdrePaiement | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await financesApi.getOrdresPaiement();
      setOrders(data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await financesApi.verifyOrdrePaiement(id);
      toast.success('Ordre vérifié avec succès');
      loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleSign = async (id: string) => {
    try {
      await financesApi.signOrdrePaiement(id);
      toast.success('Ordre signé avec succès');
      loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleTransmit = async (id: string) => {
    const referenceBank = prompt('Référence bancaire:');
    if (!referenceBank) return;
    
    try {
      await financesApi.transmitOrdrePaiement(id, referenceBank);
      toast.success('Ordre transmis avec succès');
      loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const getStatusBadge = (statut: PaymentOrderStatus) => {
    const colors = {
      [PaymentOrderStatus.BROUILLON]: 'bg-gray-500',
      [PaymentOrderStatus.VERIFIE]: 'bg-blue-500',
      [PaymentOrderStatus.SIGNE]: 'bg-green-500',
      [PaymentOrderStatus.TRANSMIS]: 'bg-purple-500',
      [PaymentOrderStatus.ANNULE]: 'bg-red-500',
    };
    return <Badge className={colors[statut]}>{statut.toUpperCase()}</Badge>;
  };

  const stats = {
    brouillon: orders.filter(o => o.statut === PaymentOrderStatus.BROUILLON).length,
    verifie: orders.filter(o => o.statut === PaymentOrderStatus.VERIFIE).length,
    signe: orders.filter(o => o.statut === PaymentOrderStatus.SIGNE).length,
    transmis: orders.filter(o => o.statut === PaymentOrderStatus.TRANSMIS).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Ordres de Paiement</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Brouillon</CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.brouillon}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vérifiés</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.verifie}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Signés</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.signe}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transmis</CardTitle>
            <Send className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.transmis}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{order.numero}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(order.dateCreation)}</td>
                    <td className="px-4 py-3 text-sm">{order.beneficiaire.nom}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      {formatCurrency(order.montant)} {order.devise}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">{order.objet}</td>
                    <td className="px-4 py-3">{getStatusBadge(order.statut)}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedOrder(order); setShowDetails(true); }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      {order.statut === PaymentOrderStatus.BROUILLON && (
                        <Button size="sm" onClick={() => handleVerify(order.id)}>
                          Vérifier
                        </Button>
                      )}
                      {order.statut === PaymentOrderStatus.VERIFIE && (
                        <Button size="sm" onClick={() => handleSign(order.id)}>
                          Signer
                        </Button>
                      )}
                      {order.statut === PaymentOrderStatus.SIGNE && (
                        <Button size="sm" onClick={() => handleTransmit(order.id)}>
                          <Send className="mr-1 h-4 w-4" /> Transmettre
                        </Button>
                      )}
                      {order.cheminPDF && (
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
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

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails de l'Ordre de Paiement</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Numéro</p>
                  <p className="font-semibold">{selectedOrder.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date Création</p>
                  <p className="font-semibold">{formatDate(selectedOrder.dateCreation)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Montant</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(selectedOrder.montant)} {selectedOrder.devise}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Montant en Lettres</p>
                  <p className="font-semibold">{selectedOrder.montantLettres}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Bénéficiaire</p>
                <div className="p-4 bg-gray-50 rounded-lg space-y-1">
                  <p className="font-semibold">{selectedOrder.beneficiaire.nom}</p>
                  <p className="text-sm">Banque: {selectedOrder.beneficiaire.banque}</p>
                  <p className="text-sm">IBAN: {selectedOrder.beneficiaire.iban}</p>
                  <p className="text-sm">Adresse: {selectedOrder.beneficiaire.adresse}</p>
                  <p className="text-sm">Pays: {selectedOrder.beneficiaire.pays}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Objet</p>
                <p className="font-semibold">{selectedOrder.objet}</p>
              </div>

              {selectedOrder.referenceBank && (
                <div>
                  <p className="text-sm text-gray-600">Référence Bancaire</p>
                  <p className="font-semibold">{selectedOrder.referenceBank}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
