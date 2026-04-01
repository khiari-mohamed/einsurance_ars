import React, { useState, useEffect } from 'react';
import { pmdApi } from '../../api/extended.api';

interface PmdInstalment {
  id: string;
  affaireId: string;
  numeroEcheance: number;
  montantDu: number;
  dateEcheance: Date;
  statut: 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD';
  montantPaye?: number;
  datePaiement?: Date;
  referencePaiement?: string;
}

interface Props {
  affaireId: string;
}

export const PmdInstalmentsManager: React.FC<Props> = ({ affaireId }) => {
  const [instalments, setInstalments] = useState<PmdInstalment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pmdTotal, setPmdTotal] = useState<number>(0);
  const [scheduleType, setScheduleType] = useState<'QUARTERLY' | 'CUSTOM'>('QUARTERLY');

  useEffect(() => {
    loadInstalments();
  }, [affaireId]);

  const loadInstalments = async () => {
    try {
      const data = await pmdApi.getByAffaire(affaireId);
      setInstalments(data);
    } catch (error) {
      console.error('Failed to load PMD instalments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async () => {
    const instalmentConfig = scheduleType === 'QUARTERLY'
      ? [
          { percentage: 25, daysFromStart: 0 },
          { percentage: 25, daysFromStart: 90 },
          { percentage: 25, daysFromStart: 180 },
          { percentage: 25, daysFromStart: 270 },
        ]
      : [
          { percentage: 50, daysFromStart: 0 },
          { percentage: 50, daysFromStart: 180 },
        ];

    try {
      await pmdApi.createSchedule(affaireId, pmdTotal, instalmentConfig);
      await loadInstalments();
      setShowCreateForm(false);
      setPmdTotal(0);
    } catch (error) {
      console.error('Failed to create PMD schedule:', error);
    }
  };

  const markAsPaid = async (id: string, montant: number) => {
    const reference = prompt('Référence de paiement:');
    if (!reference) return;

    try {
      await pmdApi.markAsPaid(id, montant, reference, new Date());
      await loadInstalments();
    } catch (error) {
      console.error('Failed to mark as paid:', error);
    }
  };

  const sendReminder = async (id: string) => {
    try {
      await pmdApi.sendReminder(id);
      alert('Relance envoyée avec succès');
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="pmd-instalments-manager">
      <div className="header">
        <h3>Échéancier PMD</h3>
        {instalments.length === 0 && (
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            Créer Échéancier
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h4>Nouveau Échéancier PMD</h4>
          <div className="form-group">
            <label>Montant Total PMD (TND)</label>
            <input
              type="number"
              value={pmdTotal}
              onChange={(e) => setPmdTotal(Number(e.target.value))}
              placeholder="Ex: 50000"
            />
          </div>
          <div className="form-group">
            <label>Type d'Échéancier</label>
            <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as any)}>
              <option value="QUARTERLY">Trimestriel (4 échéances)</option>
              <option value="CUSTOM">Semestriel (2 échéances)</option>
            </select>
          </div>
          <div className="form-actions">
            <button onClick={createSchedule} className="btn-primary">Créer</button>
            <button onClick={() => setShowCreateForm(false)} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {instalments.length > 0 && (
        <table className="instalments-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date Échéance</th>
              <th>Montant Dû</th>
              <th>Statut</th>
              <th>Montant Payé</th>
              <th>Date Paiement</th>
              <th>Référence</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instalments.map((inst) => (
              <tr key={inst.id} className={`status-${inst.statut.toLowerCase()}`}>
                <td>{inst.numeroEcheance}</td>
                <td>{new Date(inst.dateEcheance).toLocaleDateString('fr-FR')}</td>
                <td>{inst.montantDu.toFixed(3)} TND</td>
                <td>
                  <span className={`badge badge-${inst.statut.toLowerCase()}`}>
                    {inst.statut.replace('_', ' ')}
                  </span>
                </td>
                <td>{inst.montantPaye?.toFixed(3) || '-'}</td>
                <td>{inst.datePaiement ? new Date(inst.datePaiement).toLocaleDateString('fr-FR') : '-'}</td>
                <td>{inst.referencePaiement || '-'}</td>
                <td>
                  {inst.statut === 'EN_ATTENTE' && (
                    <>
                      <button onClick={() => markAsPaid(inst.id, inst.montantDu)} className="btn-sm btn-success">
                        Marquer Payé
                      </button>
                      <button onClick={() => sendReminder(inst.id)} className="btn-sm btn-warning">
                        Relancer
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
