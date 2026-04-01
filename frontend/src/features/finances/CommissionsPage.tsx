import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { Commission, CommissionStatus, CommissionType } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filters, setFilters] = useState<{
    type: string;
    statut: string;
    affaireId: string;
  }>({
    type: '',
    statut: '',
    affaireId: '',
  });
  const [stats, setStats] = useState({
    totalCalculee: 0,
    totalAPayer: 0,
    totalPayee: 0,
    countARS: 0,
    countCedante: 0,
  });

  useEffect(() => {
    loadCommissions();
  }, [filters]);

  const loadCommissions = async () => {
    try {
      const response = await financesApi.getCommissions({
        ...filters,
        type: filters.type || undefined,
        statut: filters.statut ? (filters.statut as CommissionStatus) : undefined,
        affaireId: filters.affaireId || undefined,
      });
      setCommissions(response.data);
      calculateStats(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const calculateStats = (data: Commission[]) => {
    const stats = {
      totalCalculee: data.filter(c => c.statut === CommissionStatus.CALCULEE).reduce((sum, c) => sum + Number(c.montant), 0),
      totalAPayer: data.filter(c => c.statut === CommissionStatus.A_PAYER).reduce((sum, c) => sum + Number(c.montant), 0),
      totalPayee: data.filter(c => c.statut === CommissionStatus.PAYEE).reduce((sum, c) => sum + Number(c.montant), 0),
      countARS: data.filter(c => c.type === CommissionType.ARS).length,
      countCedante: data.filter(c => c.type === CommissionType.CEDANTE).length,
    };
    setStats(stats);
  };

  const getStatusBadge = (statut: CommissionStatus) => {
    const colors = {
      [CommissionStatus.CALCULEE]: 'bg-blue-500',
      [CommissionStatus.A_PAYER]: 'bg-yellow-500',
      [CommissionStatus.PAYEE]: 'bg-green-500',
      [CommissionStatus.ANNULEE]: 'bg-red-500',
    };
    return <Badge className={colors[statut]}>{statut.toUpperCase()}</Badge>;
  };

  const getTypeBadge = (type: CommissionType) => {
    const colors = {
      [CommissionType.ARS]: 'bg-purple-500',
      [CommissionType.CEDANTE]: 'bg-indigo-500',
      [CommissionType.COURTIER]: 'bg-cyan-500',
    };
    return <Badge className={colors[type]}>{type.toUpperCase()}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion des Commissions</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calculées</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.totalCalculee)}
            </div>
            <p className="text-xs text-gray-500">En attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">À Payer</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.totalAPayer)}
            </div>
            <p className="text-xs text-gray-500">Validation requise</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalPayee)}
            </div>
            <p className="text-xs text-gray-500">Complétées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commissions ARS</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.countARS}
            </div>
            <p className="text-xs text-gray-500">{stats.countCedante} cédantes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de commission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les types</SelectItem>
                  <SelectItem value={CommissionType.ARS}>ARS</SelectItem>
                  <SelectItem value={CommissionType.CEDANTE}>Cédante</SelectItem>
                  <SelectItem value={CommissionType.COURTIER}>Courtier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.statut} onValueChange={(v) => setFilters({ ...filters, statut: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les statuts</SelectItem>
                  <SelectItem value={CommissionStatus.CALCULEE}>Calculée</SelectItem>
                  <SelectItem value={CommissionStatus.A_PAYER}>À Payer</SelectItem>
                  <SelectItem value={CommissionStatus.PAYEE}>Payée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                placeholder="ID Affaire"
                value={filters.affaireId}
                onChange={(e) => setFilters({ ...filters, affaireId: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFilters({ type: '', statut: '', affaireId: '' })}>
                Réinitialiser
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" /> Exporter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{comm.numero}</td>
                    <td className="px-4 py-3">{getTypeBadge(comm.type)}</td>
                    <td className="px-4 py-3 text-sm">
                      {comm.affaire?.numero || comm.affaireId}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatCurrency(comm.baseMontant)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {Number(comm.taux).toFixed(2)}%
                      {comm.tauxOverride && <span className="ml-1 text-orange-500">*</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">
                      {formatCurrency(comm.montant)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(comm.statut)}</td>
                    <td className="px-4 py-3 text-sm">
                      {comm.dateCalcul ? formatDate(comm.dateCalcul) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
