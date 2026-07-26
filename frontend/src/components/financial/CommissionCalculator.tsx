import { useState } from 'react';

// FIX (Finances pass): the commission math was wrong — it chained ARS
// commission off the premium NET of cedante commission
// (commissionARS = (primeCedee - commissionCedante) * tauxARS/100). The
// real CommissionCalculatorService computes both independently, off the
// SAME primeBrute base: commissionCedante = primeBrute × tauxCedante/100
// and commissionArs = primeBrute × tauxArs/100 — not chained. Fixed to
// match. Kept as a standalone what-if calculator (no API call needed).
export default function CommissionCalculator() {
  const [primeBrute, setPrimeBrute] = useState(0);
  const [tauxCedante, setTauxCedante] = useState(0);
  const [tauxARS, setTauxARS] = useState(0);

  const commissionCedante = primeBrute * (tauxCedante / 100);
  const commissionARS = primeBrute * (tauxARS / 100);
  const primeNetteReassureur = primeBrute - commissionARS - commissionCedante;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Calculateur de Commissions</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Prime Brute (part réassureur)</label>
          <input type="number" value={primeBrute} onChange={(e) => setPrimeBrute(Number(e.target.value))} className="w-full px-4 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Taux Commission Cédante (%)</label>
          <input type="number" value={tauxCedante} onChange={(e) => setTauxCedante(Number(e.target.value))} className="w-full px-4 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Taux Commission ARS (%)</label>
          <input type="number" value={tauxARS} onChange={(e) => setTauxARS(Number(e.target.value))} className="w-full px-4 py-2 border rounded" />
        </div>
        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between"><span className="font-medium">Commission Cédante:</span><span className="text-blue-600 font-bold">{commissionCedante.toFixed(3)} TND</span></div>
          <div className="flex justify-between"><span className="font-medium">Commission ARS:</span><span className="text-green-600 font-bold">{commissionARS.toFixed(3)} TND</span></div>
          <div className="flex justify-between"><span className="font-medium">Prime Nette Réassureur:</span><span className="text-purple-600 font-bold">{primeNetteReassureur.toFixed(3)} TND</span></div>
        </div>
      </div>
    </div>
  );
}