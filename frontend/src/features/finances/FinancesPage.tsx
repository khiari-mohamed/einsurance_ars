import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, TrendingUp, TrendingDown, DollarSign, CheckCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { Encaissement, Decaissement, EncaissementStatus, DecaissementStatus } from '@/types/finance.types';
import EncaissementForm from './EncaissementForm';
import DecaissementForm from './DecaissementForm';
import LettrageView from './LettrageView';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function FinancesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('encaissements');
  const [encaissements, setEncaissements] = useState<Encaissement[]>([]);
  const [decaissements, setDecaissements] = useState<Decaissement[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showEncForm, setShowEncForm] = useState(false);
  const [showDecForm, setShowDecForm] = useState(false);
  const [selectedEnc, setSelectedEnc] = useState<string | undefined>();
  const [selectedDec, setSelectedDec] = useState<string | undefined>();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      if (activeTab === 'encaissements') {
        const response = await financesApi.getEncaissements();
        setEncaissements(response.data);
      } else if (activeTab === 'decaissements') {
        const response = await financesApi.getDecaissements();
        setDecaissements(response.data);
      }
      await loadStats();
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const loadStats = async () => {
    try {
      const startDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      const data = await financesApi.getCashFlowReport(startDate, endDate);
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleValidateEncaissement = async (id: string) => {
    try {
      await financesApi.validateEncaissement(id);
      toast.success('Encaissement validé');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleApproveDecaissement = async (id: string, niveau: number) => {
    try {
      await financesApi.approveDecaissement(id, niveau);
      toast.success(`Décaissement approuvé niveau ${niveau}`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleExecuteDecaissement = async (id: string) => {
    try {
      await financesApi.executeDecaissement(id);
      toast.success('Décaissement exécuté');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      brouillon: 'bg-gray-500',
      saisi: 'bg-blue-500',
      valide: 'bg-green-500',
      comptabilise: 'bg-purple-500',
      approuve_n1: 'bg-yellow-500',
      approuve_n2: 'bg-orange-500',
      ordonnance: 'bg-indigo-500',
      execute: 'bg-green-600',
      annule: 'bg-red-500',
    };
    return <Badge className={colors[statut] || 'bg-gray-500'}>{statut.toUpperCase()}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion Financière</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Encaissements</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalEncaissements)}
              </div>
              <p className="text-xs text-gray-500">{stats.encaissements} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Décaissements</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalDecaissements)}
              </div>
              <p className="text-xs text-gray-500">{stats.decaissements} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Solde Net</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.soldeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.soldeNet)}
              </div>
              <p className="text-xs text-gray-500">Année en cours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taux de Recouvrement</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalEncaissements > 0 
                  ? ((stats.totalEncaissements / (stats.totalEncaissements + stats.totalDecaissements)) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-xs text-gray-500">Performance</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="encaissements">Encaissements</TabsTrigger>
          <TabsTrigger value="decaissements">Décaissements</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="settlements">Situations</TabsTrigger>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {encaissements.map((enc) => (
                      <tr key={enc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{enc.numero}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(enc.dateEncaissement)}</td>
                        <td className="px-4 py-3 text-sm">
                          {enc.cedante?.nom || enc.client?.nom || enc.reassureur?.nom || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {formatCurrency(enc.montantEquivalentTND)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(enc.statut)}</td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {enc.statut === EncaissementStatus.SAISI && (
                            <Button size="sm" onClick={() => handleValidateEncaissement(enc.id)}>
                              Valider
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { setSelectedEnc(enc.id); setShowEncForm(true); }}>
                            Modifier
                          </Button>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {decaissements.map((dec) => (
                      <tr key={dec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{dec.numero}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(dec.dateDecaissement)}</td>
                        <td className="px-4 py-3 text-sm">
                          {dec.reassureur?.nom || dec.cedante?.nom || dec.courtier?.nom || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {formatCurrency(dec.montantEquivalentTND)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(dec.statut)}</td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {dec.statut === DecaissementStatus.BROUILLON && (
                            <Button size="sm" onClick={() => handleApproveDecaissement(dec.id, 1)}>
                              Approuver N1
                            </Button>
                          )}
                          {dec.statut === DecaissementStatus.APPROUVE_N1 && (
                            <Button size="sm" onClick={() => handleApproveDecaissement(dec.id, 2)}>
                              Approuver N2
                            </Button>
                          )}
                          {dec.statut === DecaissementStatus.ORDONNANCE && (
                            <Button size="sm" onClick={() => handleExecuteDecaissement(dec.id)}>
                              Exécuter
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { setSelectedDec(dec.id); setShowDecForm(true); }}>
                            Modifier
                          </Button>
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

        <TabsContent value="settlements">
          <div className="text-center py-8">
            <Button onClick={() => navigate('/finances/settlements')}>Ouvrir Situations</Button>
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
          <DialogHeader>
            <DialogTitle>{selectedEnc ? 'Modifier' : 'Nouveau'} Encaissement</DialogTitle>
          </DialogHeader>
          <EncaissementForm
            encaissementId={selectedEnc}
            onSuccess={() => { setShowEncForm(false); loadData(); }}
            onCancel={() => setShowEncForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDecForm} onOpenChange={setShowDecForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDec ? 'Modifier' : 'Nouveau'} Décaissement</DialogTitle>
          </DialogHeader>
          <DecaissementForm
            decaissementId={selectedDec}
            onSuccess={() => { setShowDecForm(false); loadData(); }}
            onCancel={() => setShowDecForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
