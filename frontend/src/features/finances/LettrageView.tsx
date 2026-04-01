import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, AlertCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { Lettrage } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function LettrageView() {
  const [lettrages, setLettrages] = useState<Lettrage[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  useEffect(() => {
    loadLettrages();
  }, []);

  const loadLettrages = async () => {
    setLoading(true);
    try {
      const data = await financesApi.getLettrages();
      setLettrages(data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const runAutoLettrage = async () => {
    setAutoRunning(true);
    try {
      const result = await financesApi.runAutoLettrage();
      toast.success(`Lettrage automatique terminé: ${result.matched} correspondances trouvées, ${result.unmatched} non appariées`);
      loadLettrages();
    } catch (error) {
      toast.error('Erreur lors du lettrage automatique');
    } finally {
      setAutoRunning(false);
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      auto: 'bg-blue-500',
      manuel: 'bg-purple-500',
      partiel: 'bg-yellow-500',
      complet: 'bg-green-500',
    };
    return <Badge className={colors[statut] || 'bg-gray-500'}>{statut.toUpperCase()}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    if (type === 'affaire') return '📄';
    if (type === 'cedante') return '🏢';
    if (type === 'reassureur') return '🏦';
    return '👤';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lettrage Automatique</CardTitle>
            <Button onClick={runAutoLettrage} disabled={autoRunning}>
              <Play className="mr-2 h-4 w-4" />
              {autoRunning ? 'Exécution...' : 'Lancer Lettrage Auto'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Le lettrage automatique compare les encaissements avec les bordereaux en attente et effectue les correspondances automatiquement.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des Lettrages</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : lettrages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun lettrage trouvé
            </div>
          ) : (
            <div className="space-y-4">
              {lettrages.map((lettrage) => (
                <div key={lettrage.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getTypeIcon(lettrage.type)}</span>
                      <div>
                        <p className="font-semibold">{lettrage.reference}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(lettrage.dateLettrage)} • Type: {lettrage.type}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(lettrage.statut)}
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Encaissements</p>
                      <p className="font-semibold text-green-700">
                        {lettrage.encaissements.length} • {formatCurrency(
                          lettrage.encaissements.reduce((sum, e) => sum + e.montantAffecte, 0)
                        )}
                      </p>
                    </div>

                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Décaissements</p>
                      <p className="font-semibold text-red-700">
                        {lettrage.decaissements.length} • {formatCurrency(
                          lettrage.decaissements.reduce((sum, d) => sum + d.montantAffecte, 0)
                        )}
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Créances</p>
                      <p className="font-semibold text-blue-700">
                        {lettrage.creances.length} • {formatCurrency(
                          lettrage.creances.reduce((sum, c) => sum + c.montantRegle, 0)
                        )}
                      </p>
                    </div>

                    <div className={`p-3 rounded ${lettrage.ecart < 0.01 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                      <p className="text-xs text-gray-600 mb-1">Écart</p>
                      <p className={`font-semibold ${lettrage.ecart < 0.01 ? 'text-green-700' : 'text-yellow-700'}`}>
                        {formatCurrency(lettrage.ecart)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {lettrage.statut === 'complet' ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Lettrage complet
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Lettrage partiel - Écart: {formatCurrency(lettrage.ecart)}
                      </div>
                    )}
                  </div>

                  {lettrage.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                      <p className="text-gray-600">{lettrage.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
