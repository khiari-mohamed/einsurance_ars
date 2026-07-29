import { Mail, Clock, CheckCircle } from 'lucide-react';
import type { Sinistre } from '../../types/sinistre.types';

interface Props { sinistre: Sinistre }

// Rebuilt off real data only — SinistreParticipation.isNotified/notifiedAt
// (one point-in-time record per reinsurer) plus the general SinistreEvent
// timeline. No notification-history log exists on the backend; not
// inventing one here — see turn notes.
export default function SinistreCommunication({ sinistre }: Props) {
  const participations = sinistre.participations ?? [];
  const reassureurMap = new Map(
    (sinistre.affaire?.reassureurs ?? []).map((r) => [r.reassureur.code, r.reassureur.raisonSociale]),
  );

  const communicationEvents = (sinistre.events ?? []).filter((e) =>
    /réassureur|notif|déclar/i.test(e.action),
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Notifications par Réassureur</h3>
        {participations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Aucun réassureur notifié — le sinistre doit être validé puis déclaré aux réassureurs.
          </div>
        ) : (
          <div className="space-y-2">
            {participations.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className={p.isNotified ? 'text-green-600' : 'text-gray-400'} size={20} />
                  <div>
                    <div className="font-medium">{reassureurMap.get(p.reassureurCode) ?? p.reassureurCode}</div>
                    <div className="text-sm text-gray-600">
                      Quote-part {p.partPct}%{p.montantPart != null && ` — ${p.montantPart.toLocaleString()} TND`}
                    </div>
                  </div>
                </div>
                {p.isNotified ? (
                  <div className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircle size={16} />
                    Notifié le {p.notifiedAt ? new Date(p.notifiedAt).toLocaleDateString('fr-FR') : '—'}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock size={16} />
                    Non notifié
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Historique des Événements Liés</h3>
        {communicationEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">Aucun événement</div>
        ) : (
          <div className="space-y-2">
            {communicationEvents.map((e) => (
              <div key={e.id} className="bg-gray-50 p-3 rounded text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{e.action}</span>
                  <span className="text-gray-500">{new Date(e.date).toLocaleString('fr-FR')}</span>
                </div>
                <div className="text-gray-600">{e.actorLabel}{e.note && ` — ${e.note}`}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}