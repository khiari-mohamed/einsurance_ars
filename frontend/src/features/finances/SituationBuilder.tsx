import { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Deal {
  id: string;
  numeroAffaire: string;
  cedante: { id: string; raisonSociale: string };
  primeCedee: number;
  sinistresTotal: number;
  devise: string;
  dateEffet: string;
}

export default function SituationBuilder() {
  const [cedanteId, setCedanteId] = useState('');
  const [cedantes, setCedantes] = useState<any[]>([]);
  const [availableDeals, setAvailableDeals] = useState<Deal[]>([]);
  const [selectedDeals, setSelectedDeals] = useState<Deal[]>([]);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCedantes();
  }, []);

  useEffect(() => {
    if (cedanteId && dateDebut && dateFin) {
      fetchDeals();
    }
  }, [cedanteId, dateDebut, dateFin]);

  const fetchCedantes = async () => {
    try {
      const res = await fetch('/api/cedantes');
      if (!res.ok) {
        setCedantes([]);
        return;
      }
      const data = await res.json();
      setCedantes(Array.isArray(data) ? data : []);
    } catch (error) {
      setCedantes([]);
      toast.error('Erreur lors du chargement des cédantes');
    }
  };

  const fetchDeals = async () => {
    try {
      const res = await fetch(
        `/api/affaires?cedanteId=${cedanteId}&dateDebut=${dateDebut}&dateFin=${dateFin}&paymentMode=inclus_situation`
      );
      if (!res.ok) {
        setAvailableDeals([]);
        return;
      }
      const data = await res.json();
      setAvailableDeals(Array.isArray(data) ? data : []);
    } catch (error) {
      setAvailableDeals([]);
      toast.error('Erreur lors du chargement des affaires');
    }
  };

  const addDeal = (deal: Deal) => {
    if (!selectedDeals.find((d) => d.id === deal.id)) {
      setSelectedDeals([...selectedDeals, deal]);
    }
  };

  const removeDeal = (dealId: string) => {
    setSelectedDeals(selectedDeals.filter((d) => d.id !== dealId));
  };

  const calculateTotals = () => {
    const totalPrimes = selectedDeals.reduce((sum, d) => sum + d.primeCedee, 0);
    const totalSinistres = selectedDeals.reduce((sum, d) => sum + d.sinistresTotal, 0);
    const solde = totalPrimes - totalSinistres;
    return { totalPrimes, totalSinistres, solde };
  };

  const generateSituation = async () => {
    if (selectedDeals.length === 0) {
      toast.error('Veuillez sélectionner au moins une affaire');
      return;
    }

    setLoading(true);
    try {
      const { totalPrimes, totalSinistres, solde } = calculateTotals();
      const res = await fetch('/api/finances/situations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedanteId,
          dateDebut,
          dateFin,
          affaireIds: selectedDeals.map((d) => d.id),
          totalPrimes,
          totalSinistres,
          solde,
          devise: selectedDeals[0]?.devise || 'TND',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Situation créée avec succès');
        // Reset
        setSelectedDeals([]);
      } else {
        toast.error('Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const { totalPrimes, totalSinistres, solde } = calculateTotals();
  const cedanteName = Array.isArray(cedantes) ? cedantes.find((c) => c.id === cedanteId)?.raisonSociale || '' : '';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Générateur de Situation</h1>
            <p className="text-gray-600">Regroupement et compensation des affaires</p>
          </div>
          <FileText size={32} className="text-blue-600" />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-1">Cédante</label>
            <select
              value={cedanteId}
              onChange={(e) => setCedanteId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Sélectionner...</option>
              {cedantes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date Début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date Fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Available Deals */}
          <div>
            <h3 className="font-semibold mb-3">Affaires Disponibles ({availableDeals.length})</h3>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {availableDeals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>Aucune affaire disponible</p>
                  <p className="text-sm">Sélectionnez une cédante et une période</p>
                </div>
              ) : (
                availableDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 border-b hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{deal.numeroAffaire}</p>
                      <p className="text-sm text-gray-600">
                        Prime: {deal.primeCedee.toFixed(2)} {deal.devise}
                      </p>
                      <p className="text-sm text-gray-600">
                        Sinistres: {deal.sinistresTotal.toFixed(2)} {deal.devise}
                      </p>
                    </div>
                    <button
                      onClick={() => addDeal(deal)}
                      disabled={selectedDeals.find((d) => d.id === deal.id) !== undefined}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Deals */}
          <div>
            <h3 className="font-semibold mb-3">Affaires Sélectionnées ({selectedDeals.length})</h3>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {selectedDeals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>Aucune affaire sélectionnée</p>
                </div>
              ) : (
                selectedDeals.map((deal) => (
                  <div key={deal.id} className="p-3 border-b hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{deal.numeroAffaire}</p>
                      <p className="text-sm text-gray-600">
                        Prime: {deal.primeCedee.toFixed(2)} {deal.devise}
                      </p>
                      <p className="text-sm text-gray-600">
                        Sinistres: {deal.sinistresTotal.toFixed(2)} {deal.devise}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDeal(deal.id)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Calculation Summary */}
        {selectedDeals.length > 0 && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="text-blue-600" size={24} />
              <h3 className="text-lg font-bold">Calcul de la Situation</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">DÉBIT (Primes)</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalPrimes.toFixed(2)} {selectedDeals[0]?.devise}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">CRÉDIT (Sinistres)</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalSinistres.toFixed(2)} {selectedDeals[0]?.devise}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">SOLDE NET</p>
                <p className={`text-2xl font-bold ${solde >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {solde.toFixed(2)} {selectedDeals[0]?.devise}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white rounded-lg">
              <p className="text-sm font-medium">
                {solde > 0 ? (
                  <span className="text-green-600">
                    ✓ {cedanteName} doit payer {solde.toFixed(2)} {selectedDeals[0]?.devise} à ARS
                  </span>
                ) : solde < 0 ? (
                  <span className="text-orange-600">
                    ⚠ ARS doit payer {Math.abs(solde).toFixed(2)} {selectedDeals[0]?.devise} à {cedanteName}
                  </span>
                ) : (
                  <span className="text-gray-600">⚖ Situation équilibrée (solde nul)</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setSelectedDeals([])}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Réinitialiser
          </button>
          <button
            onClick={generateSituation}
            disabled={loading || selectedDeals.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={16} />
            {loading ? 'Génération...' : 'Générer la Situation'}
          </button>
        </div>
      </div>
    </div>
  );
}
