import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Edit2, Trash2, Download, Upload, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface ExchangeRate {
  id: string;
  devise: string;
  tauxRealisation: number;
  tauxReglement: number;
  dateDebut: string;
  dateFin: string;
  source: string;
  createdAt: string;
  createdBy: string;
}

export default function ExchangeRatesManager() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [formData, setFormData] = useState({
    devise: 'USD',
    tauxRealisation: 0,
    tauxReglement: 0,
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    source: 'BCT',
  });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await fetch('/api/finances/exchange-rates');
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRate
        ? `/api/finances/exchange-rates/${editingRate.id}`
        : '/api/finances/exchange-rates';
      const method = editingRate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingRate ? 'Taux modifié avec succès' : 'Taux ajouté avec succès');
        fetchRates();
        setShowModal(false);
        resetForm();
      } else {
        toast.error('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce taux ?')) return;

    try {
      const res = await fetch(`/api/finances/exchange-rates/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Taux supprimé avec succès');
        fetchRates();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setFormData({
      devise: rate.devise,
      tauxRealisation: rate.tauxRealisation,
      tauxReglement: rate.tauxReglement,
      dateDebut: rate.dateDebut,
      dateFin: rate.dateFin,
      source: rate.source,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingRate(null);
    setFormData({
      devise: 'USD',
      tauxRealisation: 0,
      tauxReglement: 0,
      dateDebut: new Date().toISOString().split('T')[0],
      dateFin: '',
      source: 'BCT',
    });
  };

  const importFromBCT = async () => {
    try {
      const res = await fetch('/api/finances/exchange-rates/import-bct', {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Taux importés depuis BCT avec succès');
        fetchRates();
      } else {
        toast.error('Erreur lors de l\'importation');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'importation');
    }
  };

  const exportRates = () => {
    const csv = [
      ['Devise', 'Taux Réalisation', 'Taux Règlement', 'Date Début', 'Date Fin', 'Source'].join(','),
      ...rates.map((r) =>
        [r.devise, r.tauxRealisation, r.tauxReglement, r.dateDebut, r.dateFin, r.source].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taux-change-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const devises = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AED'];

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold">Cours de Change</h1>
              <p className="text-sm text-gray-600">Gestion des taux de change (BCT)</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={importFromBCT}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Upload size={16} />
              Importer BCT
            </button>
            <button
              onClick={exportRates}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Download size={16} />
              Exporter
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              Nouveau Taux
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <p className="text-sm text-gray-700">
            <strong>Taux de Réalisation:</strong> Utilisé lors de l'enregistrement de l'affaire (booking)
            <br />
            <strong>Taux de Règlement:</strong> Utilisé lors du paiement effectif
            <br />
            <strong>Écart:</strong> La différence génère automatiquement un gain ou une perte de change
          </p>
        </div>

        {/* Rates Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Devise</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Taux Réalisation</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Taux Règlement</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Écart</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Période</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Aucun taux de change enregistré
                  </td>
                </tr>
              ) : (
                rates.map((rate) => {
                  const ecart = ((rate.tauxReglement - rate.tauxRealisation) / rate.tauxRealisation) * 100;
                  return (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-600">{rate.devise}/TND</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{rate.tauxRealisation.toFixed(6)}</td>
                      <td className="px-4 py-3 text-right font-mono">{rate.tauxReglement.toFixed(6)}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            ecart > 0 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}
                        >
                          {ecart > 0 ? '+' : ''}
                          {ecart.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(rate.dateDebut).toLocaleDateString()}
                          {rate.dateFin && (
                            <>
                              <span className="text-gray-400">→</span>
                              {new Date(rate.dateFin).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{rate.source}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(rate)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(rate.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              {editingRate ? 'Modifier le Taux' : 'Nouveau Taux de Change'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Devise</label>
                <select
                  value={formData.devise}
                  onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  {devises.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Taux de Réalisation (booking)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.tauxRealisation}
                  onChange={(e) => setFormData({ ...formData, tauxRealisation: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Taux de Règlement (payment)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.tauxReglement}
                  onChange={(e) => setFormData({ ...formData, tauxReglement: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date Début</label>
                  <input
                    type="date"
                    value={formData.dateDebut}
                    onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date Fin (optionnel)</label>
                  <input
                    type="date"
                    value={formData.dateFin}
                    onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="BCT">BCT (Banque Centrale de Tunisie)</option>
                  <option value="Manuel">Manuel</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingRate ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
