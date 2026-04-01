import { Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  sinistre: any;
}

export default function SinistreCommunication({ sinistre }: Props) {
  const notifications = sinistre.participations?.flatMap((p: any) => 
    p.notifications?.map((n: any) => ({
      ...n,
      reassureur: p.reassureur,
    })) || []
  ) || [];

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'envoye': return <CheckCircle className="text-green-600" size={16} />;
      case 'lu': return <CheckCircle className="text-blue-600" size={16} />;
      case 'erreur': return <AlertCircle className="text-red-600" size={16} />;
      default: return <Clock className="text-gray-600" size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Historique des Communications</h3>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          Aucune notification envoyée
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif: any, idx: number) => (
            <div key={idx} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Mail className="text-blue-600 mt-1" size={20} />
                  <div>
                    <div className="font-medium">{notif.reassureur?.raisonSociale}</div>
                    <div className="text-sm text-gray-600">
                      Type: {notif.type} • Moyen: {notif.moyen}
                    </div>
                    {notif.message && (
                      <div className="text-sm text-gray-700 mt-2">{notif.message}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(notif.date).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(notif.statut)}
                  <span className="text-sm text-gray-600 capitalize">{notif.statut}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
