import React, { useState, useEffect } from 'react';
import { guaranteeLinesApi } from '../../api/extended.api';

interface GuaranteeLine {
  id: string;
  affaireId: string;
  numeroLigne: number;
  codeGarantie: string;
  libelleGarantie: string;
  capitalAssure: number;
  tauxPrime: number;
  primeNette: number;
  franchise?: number;
  plafond?: number;
  observations?: string;
}

interface Props {
  affaireId: string;
}

export const GuaranteeLinesManager: React.FC<Props> = ({ affaireId }) => {
  const [lines, setLines] = useState<GuaranteeLine[]>([]);
  const [totals, setTotals] = useState<{ totalCapital: number; totalPrime: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<GuaranteeLine>>({});

  useEffect(() => {
    loadLines();
  }, [affaireId]);

  const loadLines = async () => {
    try {
      const [linesData, totalsData] = await Promise.all([
        guaranteeLinesApi.getByAffaire(affaireId),
        guaranteeLinesApi.getTotals(affaireId),
      ]);
      setLines(linesData);
      setTotals(totalsData);
    } catch (error) {
      console.error('Failed to load guarantee lines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await guaranteeLinesApi.create({
        ...formData,
        affaireId,
        numeroLigne: lines.length + 1,
      });
      await loadLines();
      setShowAddForm(false);
      setFormData({});
    } catch (error) {
      console.error('Failed to add guarantee line:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await guaranteeLinesApi.update(id, formData);
      await loadLines();
      setEditingId(null);
      setFormData({});
    } catch (error) {
      console.error('Failed to update guarantee line:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette ligne de garantie?')) return;
    try {
      await guaranteeLinesApi.delete(id);
      await loadLines();
    } catch (error) {
      console.error('Failed to delete guarantee line:', error);
    }
  };

  const startEdit = (line: GuaranteeLine) => {
    setEditingId(line.id);
    setFormData(line);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({});
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="guarantee-lines-manager">
      <div className="header">
        <h3>Lignes de Garantie</h3>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          Ajouter Ligne
        </button>
      </div>

      {showAddForm && (
        <div className="add-form">
          <h4>Nouvelle Ligne de Garantie</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Code Garantie *</label>
              <input
                type="text"
                value={formData.codeGarantie || ''}
                onChange={(e) => setFormData({ ...formData, codeGarantie: e.target.value })}
                placeholder="Ex: RC-AUTO"
              />
            </div>
            <div className="form-group">
              <label>Libellé Garantie *</label>
              <input
                type="text"
                value={formData.libelleGarantie || ''}
                onChange={(e) => setFormData({ ...formData, libelleGarantie: e.target.value })}
                placeholder="Ex: Responsabilité Civile Automobile"
              />
            </div>
            <div className="form-group">
              <label>Capital Assuré (TND) *</label>
              <input
                type="number"
                step="0.001"
                value={formData.capitalAssure || ''}
                onChange={(e) => setFormData({ ...formData, capitalAssure: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Taux Prime (%) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.tauxPrime || ''}
                onChange={(e) => {
                  const taux = Number(e.target.value);
                  const prime = formData.capitalAssure ? (formData.capitalAssure * taux) / 100 : 0;
                  setFormData({ ...formData, tauxPrime: taux, primeNette: prime });
                }}
              />
            </div>
            <div className="form-group">
              <label>Prime Nette (TND)</label>
              <input
                type="number"
                step="0.001"
                value={formData.primeNette || ''}
                readOnly
                className="readonly"
              />
            </div>
            <div className="form-group">
              <label>Franchise (TND)</label>
              <input
                type="number"
                step="0.001"
                value={formData.franchise || ''}
                onChange={(e) => setFormData({ ...formData, franchise: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Plafond (TND)</label>
              <input
                type="number"
                step="0.001"
                value={formData.plafond || ''}
                onChange={(e) => setFormData({ ...formData, plafond: Number(e.target.value) })}
              />
            </div>
            <div className="form-group full-width">
              <label>Observations</label>
              <textarea
                value={formData.observations || ''}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="form-actions">
            <button onClick={handleAdd} className="btn-primary">Ajouter</button>
            <button onClick={() => { setShowAddForm(false); setFormData({}); }} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      <table className="guarantee-lines-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Code</th>
            <th>Garantie</th>
            <th>Capital Assuré</th>
            <th>Taux Prime</th>
            <th>Prime Nette</th>
            <th>Franchise</th>
            <th>Plafond</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              {editingId === line.id ? (
                <>
                  <td>{line.numeroLigne}</td>
                  <td>
                    <input
                      type="text"
                      value={formData.codeGarantie || ''}
                      onChange={(e) => setFormData({ ...formData, codeGarantie: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={formData.libelleGarantie || ''}
                      onChange={(e) => setFormData({ ...formData, libelleGarantie: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={formData.capitalAssure || ''}
                      onChange={(e) => setFormData({ ...formData, capitalAssure: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={formData.tauxPrime || ''}
                      onChange={(e) => {
                        const taux = Number(e.target.value);
                        const prime = formData.capitalAssure ? (formData.capitalAssure * taux) / 100 : 0;
                        setFormData({ ...formData, tauxPrime: taux, primeNette: prime });
                      }}
                    />
                  </td>
                  <td>{formData.primeNette?.toFixed(3)}</td>
                  <td>
                    <input
                      type="number"
                      value={formData.franchise || ''}
                      onChange={(e) => setFormData({ ...formData, franchise: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={formData.plafond || ''}
                      onChange={(e) => setFormData({ ...formData, plafond: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <button onClick={() => handleUpdate(line.id)} className="btn-sm btn-success">✓</button>
                    <button onClick={cancelEdit} className="btn-sm btn-secondary">✗</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{line.numeroLigne}</td>
                  <td>{line.codeGarantie}</td>
                  <td>{line.libelleGarantie}</td>
                  <td>{line.capitalAssure.toFixed(3)} TND</td>
                  <td>{line.tauxPrime}%</td>
                  <td>{line.primeNette.toFixed(3)} TND</td>
                  <td>{line.franchise?.toFixed(3) || '-'}</td>
                  <td>{line.plafond?.toFixed(3) || '-'}</td>
                  <td>
                    <button onClick={() => startEdit(line)} className="btn-sm btn-primary">Modifier</button>
                    <button onClick={() => handleDelete(line.id)} className="btn-sm btn-danger">Supprimer</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="totals-row">
              <td colSpan={3}><strong>TOTAUX</strong></td>
              <td><strong>{totals.totalCapital.toFixed(3)} TND</strong></td>
              <td></td>
              <td><strong>{totals.totalPrime.toFixed(3)} TND</strong></td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};
