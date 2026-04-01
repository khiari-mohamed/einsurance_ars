import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { gedApi } from '../../api/ged.api';

export default function ComplianceDashboard() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const data = await gedApi.getMissingDocumentsReport();
      setReport(data);
    } catch (error) {
      console.error('Failed to load compliance report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conformité Documentaire</h2>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Actualiser
        </button>
      </div>

      {report.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <p className="text-green-800 font-medium">Tous les documents obligatoires sont présents!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-800 font-medium">
                {report.length} entité(s) avec des documents manquants
              </p>
            </div>
          </div>

          {report.map((item, i) => (
            <div key={i} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {item.entityType}
                    </span>
                    <span className="text-sm text-gray-600">ID: {item.entityId}</span>
                  </div>

                  {item.missing && item.missing.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-600 mb-1">
                        Documents manquants ({item.missing.length}):
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {item.missing.map((doc: string, j: number) => (
                          <li key={j} className="text-sm text-gray-700">
                            {doc.replace(/_/g, ' ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.expired > 0 && (
                    <p className="text-sm text-orange-600 mt-2">
                      {item.expired} document(s) expiré(s)
                    </p>
                  )}
                </div>

                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  onClick={() => window.location.href = `/${item.entityType}/${item.entityId}`}
                >
                  Voir l'entité
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
