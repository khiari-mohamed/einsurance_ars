import { BookOpen, FileText, TrendingUp, Lock, Unlock, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptabiliteApi } from '../../api/comptabilite.api';
import { toast } from 'sonner';

export default function ComptabiliteDashboard() {
  const currentYear = new Date().getFullYear();
  const exercice = currentYear;
  const queryClient = useQueryClient();

  const { data: currentPeriod } = useQuery({
    queryKey: ['current-period'],
    queryFn: () => comptabiliteApi.getCurrentPeriod().then(r => r.data),
  });

  const { data: balance } = useQuery({
    queryKey: ['trial-balance-dashboard', exercice],
    queryFn: () => comptabiliteApi.getTrialBalance(exercice).then(r => r.data),
  });

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss-dashboard', exercice],
    queryFn: () => comptabiliteApi.getProfitLoss(exercice).then(r => r.data),
  });

  const closePeriodMutation = useMutation({
    mutationFn: (data: { exercice: number; mois: number }) =>
      comptabiliteApi.closePeriod(data.exercice, data.mois),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-period'] });
      toast.success('P\u00e9riode cl\u00f4tur\u00e9e');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la cl\u00f4ture');
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: (data: { exercice: number; mois: number }) =>
      comptabiliteApi.reopenPeriod(data.exercice, data.mois),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-period'] });
      toast.success('P\u00e9riode r\u00e9ouverte');
    },
  });

  const handleClosePeriod = () => {
    if (!currentPeriod) return;
    if (confirm(`Confirmer la cl\u00f4ture de la p\u00e9riode ${currentPeriod.code} ?`)) {
      closePeriodMutation.mutate({
        exercice: currentPeriod.exercice,
        mois: currentPeriod.mois,
      });
    }
  };

  const handleReopenPeriod = () => {
    if (!currentPeriod) return;
    if (confirm(`Confirmer la r\u00e9ouverture de la p\u00e9riode ${currentPeriod.code} ?`)) {
      reopenPeriodMutation.mutate({
        exercice: currentPeriod.exercice,
        mois: currentPeriod.mois,
      });
    }
  };

  const totalDebit = balance?.totalDebit || 0;
  const totalCredit = balance?.totalCredit || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de Bord Comptabilit\u00e9</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">P\u00e9riode Actuelle</p>
              <p className="text-xl font-bold text-gray-900">
                {currentPeriod?.code || '-'}
              </p>
              <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                currentPeriod?.statut === 'open' ? 'bg-green-100 text-green-800' :
                currentPeriod?.statut === 'closed' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {currentPeriod?.statut === 'open' ? 'Ouverte' :
                 currentPeriod?.statut === 'closed' ? 'Cl\u00f4tur\u00e9e' : 'Verrouill\u00e9e'}
              </span>
            </div>
            {currentPeriod?.statut === 'open' ? (
              <Lock className="text-gray-400" size={32} />
            ) : (
              <Unlock className="text-gray-400" size={32} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total D\u00e9bit</p>
              <p className="text-xl font-bold text-blue-600">
                {totalDebit.toLocaleString()} TND
              </p>
            </div>
            <BookOpen className="text-blue-400" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Cr\u00e9dit</p>
              <p className="text-xl font-bold text-purple-600">
                {totalCredit.toLocaleString()} TND
              </p>
            </div>
            <FileText className="text-purple-400" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">\u00c9quilibre</p>
              <p className={`text-xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {isBalanced ? '\u00c9quilibr\u00e9' : 'D\u00e9s\u00e9quilibr\u00e9'}
              </p>
              {!isBalanced && (
                <p className="text-xs text-red-600 mt-1">
                  \u00c9cart: {Math.abs(totalDebit - totalCredit).toLocaleString()} TND
                </p>
              )}
            </div>
            {isBalanced ? (
              <TrendingUp className="text-green-400" size={32} />
            ) : (
              <AlertCircle className="text-red-400" size={32} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">R\u00e9sultat de l'Exercice {exercice}</h2>
          </div>
          <div className="p-6">
            {profitLoss ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Charges:</span>
                  <span className="text-lg font-semibold text-red-600">
                    {profitLoss.charges.total.toLocaleString()} TND
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Produits:</span>
                  <span className="text-lg font-semibold text-green-600">
                    {profitLoss.produits.total.toLocaleString()} TND
                  </span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">R\u00e9sultat Net:</span>
                    <span className={`text-2xl font-bold ${profitLoss.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(profitLoss.resultat).toLocaleString()} TND
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 text-right mt-1">
                    {profitLoss.resultat >= 0 ? 'B\u00e9n\u00e9fice' : 'Perte'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucune donn\u00e9e</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Gestion de P\u00e9riode</h2>
          </div>
          <div className="p-6">
            {currentPeriod ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">P\u00e9riode en cours</p>
                  <p className="text-2xl font-bold text-gray-900">{currentPeriod.code}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(currentPeriod.dateDebut).toLocaleDateString()} - {new Date(currentPeriod.dateFin).toLocaleDateString()}
                  </p>
                </div>

                {currentPeriod.statut === 'open' ? (
                  <button
                    onClick={handleClosePeriod}
                    disabled={closePeriodMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Lock size={20} />
                    Cl\u00f4turer la P\u00e9riode
                  </button>
                ) : currentPeriod.statut === 'closed' ? (
                  <button
                    onClick={handleReopenPeriod}
                    disabled={reopenPeriodMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Unlock size={20} />
                    R\u00e9ouvrir la P\u00e9riode
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      P\u00e9riode verrouill\u00e9e - Contact administrateur
                    </p>
                  </div>
                )}

                {currentPeriod.dateCloture && (
                  <p className="text-xs text-gray-500 text-center">
                    Cl\u00f4tur\u00e9e le {new Date(currentPeriod.dateCloture).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucune p\u00e9riode active</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Acc\u00e8s Rapides</h2>
        </div>
        <div className="p-6 grid grid-cols-4 gap-4">
          <a
            href="/comptabilite/plan-comptable"
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <BookOpen className="text-blue-600 mb-2" size={32} />
            <span className="text-sm font-medium text-center">Plan Comptable</span>
          </a>
          <a
            href="/comptabilite/grand-livre"
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <FileText className="text-purple-600 mb-2" size={32} />
            <span className="text-sm font-medium text-center">Grand Livre</span>
          </a>
          <a
            href="/comptabilite/balance"
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <TrendingUp className="text-green-600 mb-2" size={32} />
            <span className="text-sm font-medium text-center">Balance</span>
          </a>
          <a
            href="/comptabilite/journal-ventes"
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <FileText className="text-orange-600 mb-2" size={32} />
            <span className="text-sm font-medium text-center">Journaux</span>
          </a>
        </div>
      </div>
    </div>
  );
}
