import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';

export default function SinistreBordereau() {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reassureurId: '',
    cedanteId: '',
  });
  const [bordereau, setBordereau] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: (data: any) => sinistresApi.generateBordereau(data),
    onSuccess: (response) => {
      setBordereau(response.data);
    },
  });

  const generatePDFMutation = useMutation({
    mutationFn: (data: any) => sinistresApi.generateBordereauPDF(data),
    onSuccess: (response) => {
      setBordereau(response.data);
      if (response.data.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
      }
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate(formData);
  };

  const handleGeneratePDF = () => {
    generatePDFMutation.mutate(formData);
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Génération Bordereau Sinistres</h1>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Paramètres</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Début</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Fin</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={handleGenerate}
            disabled={!formData.startDate || !formData.endDate || generateMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText size={18} />
            {generateMutation.isPending ? 'Génération...' : 'Générer Aperçu'}
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={!formData.startDate || !formData.endDate || generatePDFMutation.isPending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={18} />
            {generatePDFMutation.isPending ? 'Génération...' : 'Générer PDF'}
          </button>
        </div>
      </div>

      {bordereau && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Bordereau {bordereau.numero}</h3>
          
          <div className="mb-4">
            <p><strong>Date d'émission:</strong> {new Date(bordereau.dateEmission).toLocaleDateString('fr-FR')}</p>
            <p><strong>Période:</strong> {new Date(bordereau.periode.debut).toLocaleDateString('fr-FR')} - {new Date(bordereau.periode.fin).toLocaleDateString('fr-FR')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-2 text-left">N° Sinistre</th>
                  <th className="border px-4 py-2 text-left">Cédante</th>
                  <th className="border px-4 py-2 text-left">Affaire</th>
                  <th className="border px-4 py-2 text-left">Date</th>
                  <th className="border px-4 py-2 text-right">Montant Total</th>
                  <th className="border px-4 py-2 text-right">Réassurance</th>
                  <th className="border px-4 py-2 text-right">Réglé</th>
                  <th className="border px-4 py-2 text-right">Restant</th>
                  <th className="border px-4 py-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {bordereau.sinistres.map((s: any) => (
                  <tr key={s.numero}>
                    <td className="border px-4 py-2">{s.numero}</td>
                    <td className="border px-4 py-2">{s.cedante}</td>
                    <td className="border px-4 py-2">{s.affaire}</td>
                    <td className="border px-4 py-2">{new Date(s.dateSurvenance).toLocaleDateString('fr-FR')}</td>
                    <td className="border px-4 py-2 text-right">{formatCurrency(s.montantTotal)}</td>
                    <td className="border px-4 py-2 text-right">{formatCurrency(s.montantReassurance)}</td>
                    <td className="border px-4 py-2 text-right">{formatCurrency(s.montantRegle)}</td>
                    <td className="border px-4 py-2 text-right">{formatCurrency(s.montantRestant)}</td>
                    <td className="border px-4 py-2">{s.statut}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={4} className="border px-4 py-2">TOTAUX</td>
                  <td className="border px-4 py-2 text-right">{formatCurrency(bordereau.totaux.montantTotal)}</td>
                  <td className="border px-4 py-2 text-right">{formatCurrency(bordereau.totaux.montantReassurance)}</td>
                  <td className="border px-4 py-2 text-right">{formatCurrency(bordereau.totaux.montantRegle)}</td>
                  <td className="border px-4 py-2 text-right">{formatCurrency(bordereau.totaux.montantRestant)}</td>
                  <td className="border px-4 py-2">{bordereau.totaux.nombreSinistres} sinistres</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
