import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Calendar, TrendingUp, Users, AlertTriangle, DollarSign } from 'lucide-react';
import { reportingApi } from '../../api/reporting.api';
import { toast } from 'sonner';

export default function ExportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', year: new Date().getFullYear() });

  const { data: sapReport } = useQuery({
    queryKey: ['sap-report', filters],
    queryFn: () => reportingApi.getSAPReport(filters).then(r => r.data),
    enabled: selectedReport === 'sap'
  });

  const { data: monthlyProduction } = useQuery({
    queryKey: ['monthly-production', filters],
    queryFn: () => reportingApi.getMonthlyProduction({ year: filters.year }).then(r => r.data),
    enabled: selectedReport === 'production'
  });

  const { data: commissionAnalysis } = useQuery({
    queryKey: ['commission-analysis', filters],
    queryFn: () => reportingApi.getCommissionAnalysis(filters).then(r => r.data),
    enabled: selectedReport === 'commissions'
  });

  const { data: cedantesPerf } = useQuery({
    queryKey: ['cedantes-performance', filters],
    queryFn: () => reportingApi.getCedantesPerformance(filters).then(r => r.data),
    enabled: selectedReport === 'cedantes'
  });

  const { data: reassureursPerf } = useQuery({
    queryKey: ['reassureurs-performance', filters],
    queryFn: () => reportingApi.getReinsurersPerformance(filters).then(r => r.data),
    enabled: selectedReport === 'reassureurs'
  });

  const { data: paymentAging } = useQuery({
    queryKey: ['payment-aging'],
    queryFn: () => reportingApi.getPaymentAging().then(r => r.data),
    enabled: selectedReport === 'aging'
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Export réussi!');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);
  };

  const reports = [
    {
      id: 'sap',
      title: 'Rapport SAP',
      description: 'Sinistres À Payer - Réserves et provisions',
      icon: <AlertTriangle className="text-orange-600" size={32} />,
      color: 'orange',
      data: sapReport?.details,
      filename: 'rapport-sap'
    },
    {
      id: 'production',
      title: 'Production Mensuelle',
      description: 'Analyse de la production par mois',
      icon: <Calendar className="text-blue-600" size={32} />,
      color: 'blue',
      data: monthlyProduction,
      filename: 'production-mensuelle'
    },
    {
      id: 'commissions',
      title: 'Analyse Commissions',
      description: 'Détail des commissions ARS et cédantes',
      icon: <DollarSign className="text-green-600" size={32} />,
      color: 'green',
      data: commissionAnalysis?.byCedante,
      filename: 'analyse-commissions'
    },
    {
      id: 'cedantes',
      title: 'Performance Cédantes',
      description: 'Analyse de performance par cédante',
      icon: <Users className="text-purple-600" size={32} />,
      color: 'purple',
      data: cedantesPerf,
      filename: 'performance-cedantes'
    },
    {
      id: 'reassureurs',
      title: 'Performance Réassureurs',
      description: 'Analyse de performance par réassureur',
      icon: <TrendingUp className="text-indigo-600" size={32} />,
      color: 'indigo',
      data: reassureursPerf,
      filename: 'performance-reassureurs'
    },
    {
      id: 'aging',
      title: 'Balance Âgée',
      description: 'Analyse des paiements en retard',
      icon: <FileText className="text-red-600" size={32} />,
      color: 'red',
      data: paymentAging?.details,
      filename: 'balance-agee'
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Exports & Rapports</h1>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date Début</label>
            <input 
              type="date" 
              className="w-full border rounded-lg p-2" 
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date Fin</label>
            <input 
              type="date" 
              className="w-full border rounded-lg p-2" 
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Année</label>
            <select 
              className="w-full border rounded-lg p-2"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
            >
              {[2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="mb-4">{report.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{report.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{report.description}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedReport(report.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${report.color}-600 text-white rounded-lg hover:bg-${report.color}-700`}
              >
                <FileText size={18} />
                Voir
              </button>
              <button 
                onClick={() => exportToCSV(report.data || [], report.filename)}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedReport && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {reports.find(r => r.id === selectedReport)?.title}
            </h2>
            <button 
              onClick={() => setSelectedReport('')}
              className="text-gray-500 hover:text-gray-700"
            >
              × Fermer
            </button>
          </div>

          {selectedReport === 'sap' && sapReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800 mb-1">Total Sinistres</p>
                  <p className="text-2xl font-bold text-blue-900">{sapReport.summary.totalSinistres}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-800 mb-1">SAP Total</p>
                  <p className="text-xl font-bold text-orange-900">{formatCurrency(sapReport.summary.montantTotalSAP)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-800 mb-1">Réserves</p>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(sapReport.summary.montantTotalReserves)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-800 mb-1">Payé</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(sapReport.summary.montantPaye)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-800 mb-1">Restant</p>
                  <p className="text-xl font-bold text-red-900">{formatCurrency(sapReport.summary.montantRestant)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Sinistre</th>
                      <th className="px-4 py-2 text-left">Affaire</th>
                      <th className="px-4 py-2 text-left">Cédante</th>
                      <th className="px-4 py-2 text-right">Montant Total</th>
                      <th className="px-4 py-2 text-right">Payé</th>
                      <th className="px-4 py-2 text-right">SAP</th>
                      <th className="px-4 py-2 text-center">Jours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sapReport.details.map((s: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{s.numeroSinistre}</td>
                        <td className="px-4 py-2">{s.affaire}</td>
                        <td className="px-4 py-2">{s.cedante}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(s.montantTotal)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(s.montantPaye)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(s.sapActuel)}</td>
                        <td className="px-4 py-2 text-center">{s.joursOuvert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReport === 'production' && monthlyProduction && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Mois</th>
                    <th className="px-4 py-2 text-right">Affaires</th>
                    <th className="px-4 py-2 text-right">Facultatives</th>
                    <th className="px-4 py-2 text-right">Traités</th>
                    <th className="px-4 py-2 text-right">Primes Cédées</th>
                    <th className="px-4 py-2 text-right">Commission ARS</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyProduction.map((m: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{m.month}</td>
                      <td className="px-4 py-2 text-right">{m.affairesCount}</td>
                      <td className="px-4 py-2 text-right">{m.facultatives}</td>
                      <td className="px-4 py-2 text-right">{m.traitees}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(m.primesCedees)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(m.commissionsARS)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'commissions' && commissionAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-800 mb-1">Commission ARS</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(commissionAnalysis.totals.commissionARS)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800 mb-1">Commission Cédante</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(commissionAnalysis.totals.commissionCedante)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-800 mb-1">Primes Totales</p>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(commissionAnalysis.totals.primes)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Cédante</th>
                      <th className="px-4 py-2 text-right">Primes</th>
                      <th className="px-4 py-2 text-right">Comm. Cédante</th>
                      <th className="px-4 py-2 text-right">Comm. ARS</th>
                      <th className="px-4 py-2 text-right">Taux ARS</th>
                      <th className="px-4 py-2 text-right">Marge Nette</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionAnalysis.byCedante.map((c: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{c.cedanteName}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(c.primes)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(c.commissionCedante)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(c.commissionARS)}</td>
                        <td className="px-4 py-2 text-right">{c.tauxCommissionARS.toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(c.margeNette)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReport === 'cedantes' && cedantesPerf && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Cédante</th>
                    <th className="px-4 py-2 text-right">Affaires</th>
                    <th className="px-4 py-2 text-right">Primes Cédées</th>
                    <th className="px-4 py-2 text-right">Encaissées</th>
                    <th className="px-4 py-2 text-right">Taux Enc.</th>
                    <th className="px-4 py-2 text-right">Délai Moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {cedantesPerf.map((c: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{c.cedanteName}</td>
                      <td className="px-4 py-2 text-right">{c.affairesCount}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(c.primesCedees)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(c.primesEncaissees)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          c.tauxEncaissement > 80 ? 'bg-green-100 text-green-800' :
                          c.tauxEncaissement > 50 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {c.tauxEncaissement.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{c.delaiMoyenPaiement.toFixed(0)} jours</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'reassureurs' && reassureursPerf && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Réassureur</th>
                    <th className="px-4 py-2 text-right">Affaires</th>
                    <th className="px-4 py-2 text-right">Capacité Totale</th>
                    <th className="px-4 py-2 text-right">Part Moyenne</th>
                    <th className="px-4 py-2 text-right">Ponctualité</th>
                  </tr>
                </thead>
                <tbody>
                  {reassureursPerf.map((r: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{r.reassureurName}</td>
                      <td className="px-4 py-2 text-right">{r.affairesCount}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(r.totalCapacity)}</td>
                      <td className="px-4 py-2 text-right">{r.averageShare.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          r.paymentTimeliness > 75 ? 'bg-green-100 text-green-800' :
                          r.paymentTimeliness > 50 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {r.paymentTimeliness}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'aging' && paymentAging && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(paymentAging.summary).map(([bucket, amount]: any, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">{bucket}</p>
                    <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Affaire</th>
                      <th className="px-4 py-2 text-left">Cédante</th>
                      <th className="px-4 py-2 text-right">Montant Dû</th>
                      <th className="px-4 py-2 text-center">Jours Retard</th>
                      <th className="px-4 py-2 text-center">Période</th>
                      <th className="px-4 py-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentAging.details.map((a: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{a.affaire}</td>
                        <td className="px-4 py-2">{a.cedante}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(a.montantDu)}</td>
                        <td className="px-4 py-2 text-center">{a.joursRetard}</td>
                        <td className="px-4 py-2 text-center">{a.bucket}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            a.statut === 'critique' ? 'bg-red-100 text-red-800' :
                            a.statut === 'urgent' ? 'bg-orange-100 text-orange-800' :
                            a.statut === 'attention' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {a.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
