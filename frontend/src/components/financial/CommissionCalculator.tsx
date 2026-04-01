import { useState } from 'react';

export default function CommissionCalculator() {
  const [primeCedee, setPrimeCedee] = useState(0);
  const [tauxCedante, setTauxCedante] = useState(0);
  const [tauxARS, setTauxARS] = useState(0);

  const commissionCedante = primeCedee * (tauxCedante / 100);
  const commissionARS = (primeCedee - commissionCedante) * (tauxARS / 100);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Calculateur de Commissions</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Prime Cédée</label>
          <input
            type="number"
            value={primeCedee}
            onChange={(e) => setPrimeCedee(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Taux Commission Cédante (%)</label>
          <input
            type="number"
            value={tauxCedante}
            onChange={(e) => setTauxCedante(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Taux Commission ARS (%)</label>
          <input
            type="number"
            value={tauxARS}
            onChange={(e) => setTauxARS(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded"
          />
        </div>
        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Commission Cédante:</span>
            <span className="text-blue-600 font-bold">{commissionCedante.toFixed(2)} TND</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Commission ARS:</span>
            <span className="text-green-600 font-bold">{commissionARS.toFixed(2)} TND</span>
          </div>
        </div>
      </div>
    </div>
  );
}
