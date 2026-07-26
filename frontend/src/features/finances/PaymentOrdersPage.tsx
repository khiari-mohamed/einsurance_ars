import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle, AlertCircle, Play, Download } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { OrdreVirementStatut, ordreStatutLabels, ordreStatutColors } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import SWIFTUpload from './SWIFTUpload';

// FIX (Finances pass): full rewrite. Real OrdrePaiement lifecycle is
// BROUILLON → VALIDE → EXECUTE → SWIFT_RECU (validate/execute/swift), not
// the fictional verify→sign→transmit workflow with no matching endpoints.
// beneficiaire is a plain string (not an object with nom/banque/rib/iban).
export default function PaymentOrdersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSwift, setShowSwift] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ordres-paiement'],
    queryFn: async () => (await financesApi.getOrdres({ limit: 50 })).data,
  });

  const orders = data?.data ?? [];
  const detail = orders.find((o) => o.id === selectedOrder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ordres-paiement'] });

  const validateMutation = useMutation({
    mutationFn: (id: string) => financesApi.validateOrdre(id),
    onSuccess: () => { toast.success('Ordre validé'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });
  const executeMutation = useMutation({
    mutationFn: (id: string) => financesApi.executeOrdre(id),
    onSuccess: () => { toast.success('Ordre exécuté'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const handleDownload = async (id: string) => {
    const { data: blob } = await financesApi.downloadOrdrePdf(id);
    const url = window.URL.createObjectURL(new Blob([blob as any]));
    const a = document.createElement('a');
    a.href = url; a.download = `ordre-paiement-${id}.pdf`; a.click();
  };

  const stats = {
    brouillon: orders.filter((o) => o.statut === OrdreVirementStatut.BROUILLON).length,
    valide: orders.filter((o) => o.statut === OrdreVirementStatut.VALIDE).length,
    execute: orders.filter((o) => o.statut === OrdreVirementStatut.EXECUTE).length,
    swift: orders.filter((o) => o.statut === OrdreVirementStatut.SWIFT_RECU).length,
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Ordres de Paiement</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Brouillon</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.brouillon}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Validés</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{stats.valide}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Exécutés</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-purple-600">{stats.execute}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">SWIFT Reçu</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.swift}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun ordre</td></tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium font-mono">{order.reference}</td>
                      <td className="px-4 py-3 text-sm">{order.beneficiaire}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(order.montant, order.currency)}</td>
                      <td className="px-4 py-3 text-sm">{order.referenceAffaire || '-'}</td>
                      <td className="px-4 py-3"><Badge className={ordreStatutColors[order.statut]}>{ordreStatutLabels[order.statut]}</Badge></td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order.id); setShowDetails(true); }}><FileText className="h-4 w-4" /></Button>
                        {order.statut === OrdreVirementStatut.BROUILLON && <Button size="sm" onClick={() => validateMutation.mutate(order.id)}><CheckCircle className="mr-1 h-4 w-4" />Valider</Button>}
                        {order.statut === OrdreVirementStatut.VALIDE && <Button size="sm" onClick={() => executeMutation.mutate(order.id)}><Play className="mr-1 h-4 w-4" />Exécuter</Button>}
                        {order.statut === OrdreVirementStatut.EXECUTE && <Button size="sm" onClick={() => { setSelectedOrder(order.id); setShowSwift(true); }}><AlertCircle className="mr-1 h-4 w-4" />SWIFT</Button>}
                        <Button size="sm" variant="outline" onClick={() => handleDownload(order.id)}><Download className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Détails de l'Ordre {detail?.reference}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-500">Bénéficiaire</p><p className="font-semibold">{detail.beneficiaire}</p></div>
                <div><p className="text-gray-500">Montant</p><p className="font-semibold">{formatCurrency(detail.montant, detail.currency)}</p></div>
              </div>
              {detail.bankAccount && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <p className="font-semibold">Coordonnées bancaires</p>
                  <p>Banque: {detail.bankAccount.banque}</p>
                  <p>RIB/IBAN: {detail.bankAccount.iban || detail.bankAccount.rib}</p>
                  {detail.bankAccount.swift && <p>SWIFT: {detail.bankAccount.swift}</p>}
                </div>
              )}
              {detail.swiftReceived && <Badge className="bg-green-500">Confirmation SWIFT reçue</Badge>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSwift} onOpenChange={setShowSwift}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confirmation SWIFT</DialogTitle></DialogHeader>
          {detail && (
            <SWIFTUpload ordrePaiementId={detail.id} reference={detail.reference} montant={detail.montant} currency={detail.currency} beneficiaire={detail.beneficiaire}
              onDone={() => { setShowSwift(false); invalidate(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}