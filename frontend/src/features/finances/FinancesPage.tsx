import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, TrendingUp, TrendingDown, DollarSign, CheckCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { DecaissementStatut, decaissementStatutLabels, decaissementStatutColors, partyTypeLabels } from '@/types/finance.types';
import EncaissementForm from './EncaissementForm';
import DecaissementForm from './DecaissementForm';
import LettrageView from './LettrageView';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/currency';

// FIX (Finances pass): full rewrite of the data layer. Real Encaissement has
// no status enum — approval is a boolean (isValidated). Real Decaissement
// has a real 4-state DecaissementStatut (BROUILLON/APPROUVE/EXECUTE/REJETE),
// not the fictional 7-state approuve_n1/approuve_n2/ordonnance workflow.
export default function FinancesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('encaissements');
  const [showEncForm, setShowEncForm] = useState(false);
  const [showDecForm, setShowDecForm] = useState(false);
  const [selectedEnc, setSelectedEnc] = useState<string | undefined>();
  const [selectedDec, setSelectedDec] = useState<string | undefined>();

  const { data: encData } = useQuery({
    queryKey: ['encaissements-hub'],
    queryFn: async () => (await financesApi.getEncaissements({ limit: 50 })).data,
    enabled: activeTab === 'encaissements',
  });
  const { data: decData } = useQuery({
    queryKey: ['decaissements-hub'],
    queryFn: async () => (await financesApi.getDecaissements({ limit: 50 })).data,
    enabled: activeTab === 'decaissements',
  });

  const today = new Date();
  const { data: stats } = useQuery({
    queryKey: ['cash-flow-ytd'],
    queryFn: async () => {
      const start = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      return (await financesApi.getCashFlowReport(start, end)).data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['encaissements-hub'] });
    queryClient.invalidateQueries({ queryKey: ['decaissements-hub'] });
    queryClient.invalidateQueries({ queryKey: ['cash-flow-ytd'] });
  };

  const handleValidateEncaissement = async (id: string) => {
    try {
      await financesApi.validateEncaissement(id);
      toast.success('Encaissement validé');
      invalidate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleApproveDecaissement = async (id: string) => {
    try {
      await financesApi.approveDecaissement(id);
      toast.success('Décaissement approuvé');
      invalidate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleExecuteDecaissement = async (id: string) => {
    try {
      await financesApi.executeDecaissement(id);
      toast.success('Décaissement exécuté');
      invalidate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion Financière</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Encaissements</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalEncaissements)}</div>
              <p className="text-xs text-gray-500">{stats.encaissements} transactions (année en cours)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Décaissements</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalDecaissements)}</div>
              <p className="text-xs text-gray-500">{stats.decaissements} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Solde Net</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.soldeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats.soldeNet)}</div>
              <p className="text-xs text-gray-500">Année en cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Part Encaissements</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalEncaissements + stats.totalDecaissements > 0
                  ? ((stats.totalEncaissements / (stats.totalEncaissements + stats.totalDecaissements)) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-xs text-gray-500">des flux totaux</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="encaissements">Encaissements</TabsTrigger>
          <TabsTrigger value="decaissements">Décaissements</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="situations">Situations</TabsTrigger>
          <TabsTrigger value="orders">Ordres Paiement</TabsTrigger>
          <TabsTrigger value="lettrage">Lettrage</TabsTrigger>
        </TabsList>

        <TabsContent value="encaissements" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setSelectedEnc(undefined); setShowEncForm(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel Encaissement
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partie</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TND</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(encData?.data ?? []).map((enc) => (
                      <tr key={enc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium font-mono">{enc.reference}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(enc.dateEncaissement)}</td>
                        <td className="px-4 py-3 text-sm">{enc.cedante?.raisonSociale || enc.assureLabel || partyTypeLabels[enc.partyType]}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(enc.montantTnd ?? enc.montant, 'TND')}</td>
                        <td className="px-4 py-3">
                          <Badge className={enc.isValidated ? 'bg-green-500' : 'bg-gray-400'}>
                            {enc.isValidated ? 'VALIDÉ' : 'NON VALIDÉ'}
                          </Badge>
                          {enc.amlFlagged && <Badge className="ml-1 bg-orange-500">AML</Badge>}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {!enc.isValidated && <Button size="sm" onClick={() => handleValidateEncaissement(enc.id)}>Valider</Button>}
                          <Button size="sm" variant="outline" onClick={() => { setSelectedEnc(enc.id); setShowEncForm(true); }}>Modifier</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decaissements" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setSelectedDec(undefined); setShowDecForm(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau Décaissement
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TND</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(decData?.data ?? []).map((dec) => (
                      <tr key={dec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium font-mono">{dec.reference}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(dec.dateDecaissement)}</td>
                        <td className="px-4 py-3 text-sm">{dec.reassureurCode || partyTypeLabels[dec.partyType]}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(dec.montantTnd ?? dec.montant, 'TND')}</td>
                        <td className="px-4 py-3">
                          <Badge className={decaissementStatutColors[dec.statut]}>{decaissementStatutLabels[dec.statut]}</Badge>
                          {dec.amlFlagged && <Badge className="ml-1 bg-orange-500">AML</Badge>}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {dec.statut === DecaissementStatut.BROUILLON && (
                            <Button size="sm" onClick={() => handleApproveDecaissement(dec.id)}>Approuver</Button>
                          )}
                          {dec.statut === DecaissementStatut.APPROUVE && (
                            <Button size="sm" onClick={() => handleExecuteDecaissement(dec.id)}>Exécuter</Button>
                          )}
                          {dec.statut === DecaissementStatut.BROUILLON && (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedDec(dec.id); setShowDecForm(true); }}>Modifier</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <div className="text-center py-8">
            <Button onClick={() => navigate('/finances/commissions')}>Ouvrir Commissions</Button>
          </div>
        </TabsContent>

        <TabsContent value="situations">
          <div className="text-center py-8">
            <Button onClick={() => navigate('/finances/situations')}>Ouvrir Situations</Button>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="text-center py-8">
            <Button onClick={() => navigate('/finances/payment-orders')}>Ouvrir Ordres de Paiement</Button>
          </div>
        </TabsContent>

        <TabsContent value="lettrage">
          <LettrageView />
        </TabsContent>
      </Tabs>

      <Dialog open={showEncForm} onOpenChange={setShowEncForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedEnc ? 'Modifier' : 'Nouveau'} Encaissement</DialogTitle></DialogHeader>
          <EncaissementForm encaissementId={selectedEnc} onSuccess={() => { setShowEncForm(false); invalidate(); }} onCancel={() => setShowEncForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showDecForm} onOpenChange={setShowDecForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedDec ? 'Modifier' : 'Nouveau'} Décaissement</DialogTitle></DialogHeader>
          <DecaissementForm decaissementId={selectedDec} onSuccess={() => { setShowDecForm(false); invalidate(); }} onCancel={() => setShowDecForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}