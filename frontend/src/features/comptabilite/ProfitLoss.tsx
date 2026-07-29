import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency } from '@/lib/currency';

export default function ProfitLoss() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useQuery({
    queryKey: ['profit-loss', year],
    queryFn: async () => (await comptabiliteApi.getProfitLoss(year)).data,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Compte de Résultat</h1>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm w-28" />
      </div>

      {isLoading || !data ? (
        <p className="text-gray-500">Chargement...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 text-red-700">Charges (classe 6)</h2>
            {data.charges.map((c) => (
              <div key={c.compte} className="flex justify-between py-1.5 border-b text-sm">
                <span>{c.compte} — {c.libelle}</span><span className="font-medium">{formatCurrency(c.debit - c.credit)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold"><span>Total charges</span><span>{formatCurrency(data.totalCharges)}</span></div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 text-green-700">Produits (classe 7)</h2>
            {data.produits.map((p) => (
              <div key={p.compte} className="flex justify-between py-1.5 border-b text-sm">
                <span>{p.compte} — {p.libelle}</span><span className="font-medium">{formatCurrency(p.credit - p.debit)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold"><span>Total produits</span><span>{formatCurrency(data.totalProduits)}</span></div>
          </div>
          <div className={`col-span-2 rounded-lg p-4 text-center font-bold text-lg ${data.resultatNet >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            Résultat Net {year}: {formatCurrency(data.resultatNet)}
          </div>
        </div>
      )}
    </div>
  );
}