import React, { useState, useEffect } from 'react';
import { treatyParametersApi } from '../../api/extended.api';

interface TreatyParameter {
  id: string;
  affaireId: string;
  version: number;
  dateDebut: Date;
  dateFin: Date;
  tauxCommission: number;
  tauxCommissionCourtage: number;
  plafondGarantie?: number;
  franchiseAbsolue?: number;
  franchiseRelative?: number;
  clauseParticuliere?: string;
  actif: boolean;
  motifModification?: string;
}

interface Props {
  affaireId: string;
}

export const TreatyParametersManager: React.FC<Props> = ({ affaireId }) => {
  const [parameters, setParameters] = useState<TreatyParameter[]>([]);
  const [activeParam, setActiveParam] = useState<TreatyParameter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<TreatyParameter>>({});

  useEffect(() => {
    loadParameters();
  }, [affaireId]);

  const loadParameters = async () => {
    try {
      const active = await treatyParametersApi.getActive(affaireId);
      setActiveParam(active);
      if (showHistory) {
        const history = await treatyParametersApi.getHistory(affaireId);
        setParameters(history);
      }
    } catch (error) {
      console.error('Failed to load treaty parameters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!activeParam) return;
    const motif = prompt('Motif de modification:');
    if (!motif) return;

    try {
      await treatyParametersApi.update(activeParam.id, formData, motif);
      await loadParameters();
      setEditMode(false);
      setFormData({});
    } catch (error) {
      console.error('Failed to update parameters:', error);
    }
  };

  const handleRenew = async () => {
    try {
      await treatyParametersApi.renew(affaireId);
      await loadParameters();
      alert('Traité renouvelé avec succès');
    } catch (error) {
      console.error('Failed to renew treaty:', error);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="treaty-parameters-manager">
      <div className="header">
        <h3>Paramètres du Traité</h3>
        <div className="actions">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary">
            {showHistory ? 'Masquer Historique' : 'Voir Historique'}
          </button>
          <button onClick={handleRenew} className="btn-primary">
            Renouveler Traité
          </button>
        </div>
      </div>

      {activeParam && (
        <div className="active-parameters">
          <h4>Paramètres Actifs (Version {activeParam.version})</h4>
          {!editMode ? (
            <div className="param-display">
              <div className="param-grid">
                <div className="param-item">
                  <label>Période de Validité</label>
                  <span>
                    {new Date(activeParam.dateDebut).toLocaleDateString('fr-FR')} - {new Date(activeParam.dateFin).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="param-item">
                  <label>Taux Commission</label>
                  <span>{activeParam.tauxCommission}%</span>
                </div>
                <div className="param-item">
                  <label>Taux Commission Courtage</label>
                  <span>{activeParam.tauxCommissionCourtage}%</span>
                </div>
                <div className="param-item">
                  <label>Plafond Garantie</label>
                  <span>{activeParam.plafondGarantie?.toFixed(3) || 'Illimité'} TND</span>
                </div>
                <div className="param-item">
                  <label>Franchise Absolue</label>
                  <span>{activeParam.franchiseAbsolue?.toFixed(3) || '-'} TND</span>
                </div>
                <div className="param-item">
                  <label>Franchise Relative</label>
                  <span>{activeParam.franchiseRelative || '-'}%</span>
                </div>
              </div>
              {activeParam.clauseParticuliere && (
                <div className="param-item full-width">
                  <label>Clause Particulière</label>
                  <p>{activeParam.clauseParticuliere}</p>
                </div>
              )}
              <button onClick={() => { setEditMode(true); setFormData(activeParam); }} className="btn-primary">
                Modifier
              </button>
            </div>
          ) : (
            <div className="param-edit">
              <div className="form-grid">
                <div className="form-group">
                  <label>Taux Commission (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tauxCommission || ''}
                    onChange={(e) => setFormData({ ...formData, tauxCommission: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Taux Commission Courtage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tauxCommissionCourtage || ''}
                    onChange={(e) => setFormData({ ...formData, tauxCommissionCourtage: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Plafond Garantie (TND)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.plafondGarantie || ''}
                    onChange={(e) => setFormData({ ...formData, plafondGarantie: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Franchise Absolue (TND)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.franchiseAbsolue || ''}
                    onChange={(e) => setFormData({ ...formData, franchiseAbsolue: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Franchise Relative (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.franchiseRelative || ''}
                    onChange={(e) => setFormData({ ...formData, franchiseRelative: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Clause Particulière</label>
                  <textarea
                    value={formData.clauseParticuliere || ''}
                    onChange={(e) => setFormData({ ...formData, clauseParticuliere: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={handleUpdate} className="btn-primary">Enregistrer</button>
                <button onClick={() => { setEditMode(false); setFormData({}); }} className="btn-secondary">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showHistory && parameters.length > 0 && (
        <div className="parameters-history">
          <h4>Historique des Modifications</h4>
          <table className="history-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Période</th>
                <th>Commission</th>
                <th>Courtage</th>
                <th>Plafond</th>
                <th>Motif</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((param) => (
                <tr key={param.id} className={param.actif ? 'active-row' : ''}>
                  <td>{param.version}</td>
                  <td>
                    {new Date(param.dateDebut).toLocaleDateString('fr-FR')} - {new Date(param.dateFin).toLocaleDateString('fr-FR')}
                  </td>
                  <td>{param.tauxCommission}%</td>
                  <td>{param.tauxCommissionCourtage}%</td>
                  <td>{param.plafondGarantie?.toFixed(3) || 'Illimité'}</td>
                  <td>{param.motifModification || '-'}</td>
                  <td>
                    <span className={`badge ${param.actif ? 'badge-success' : 'badge-secondary'}`}>
                      {param.actif ? 'Actif' : 'Archivé'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
