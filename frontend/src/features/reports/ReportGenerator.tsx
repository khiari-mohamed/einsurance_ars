import { useState } from 'react';
import { FileText, Download, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface ReportGeneratorProps {
  affaireId?: string;
  type: 'note_debit' | 'bordereau_reassureur' | 'claim_account' | 'treaty_statement' | 'premium_invoice';
}

export default function ReportGenerator({ affaireId, type }: ReportGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cedanteId: '',
    reassureurId: '',
    dateDebut: '',
    dateFin: '',
    periode: 'Q1-2024',
    includeAmountInWords: true,
  });

  const reportTypes = {
    note_debit: {
      title: 'Note de Débit / Bordereau de Cession Cédante',
      description: 'Document officiel avec montant en lettres',
    },
    bordereau_reassureur: {
      title: 'Bordereau de Cession Réassureur',
      description: 'Par réassureur avec leur part spécifique',
    },
    claim_account: {
      title: 'Facultative Reinsurance Claim Account',
      description: 'Compte de sinistre facultatif',
    },
    treaty_statement: {
      title: 'Treaty Statement of Accounts',
      description: 'Relevé trimestriel/annuel avec toutes les colonnes',
    },
    premium_invoice: {
      title: 'Reinsurance Premium Invoice',
      description: 'Facture de prime de dépôt (XOL)',
    },
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reporting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          affaireId,
          ...formData,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        toast.success('Rapport généré avec succès');
      } else {
        toast.error('Erreur lors de la génération');
      }
    } catch (error) {
      toast.error('Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${type}-${Date.now()}.pdf`;
    a.click();
  };

  const printReport = () => {
    if (!pdfUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
    };
  };

  const currentReport = reportTypes[type];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-blue-600" size={32} />
        <div>
          <h2 className="text-xl font-bold">{currentReport.title}</h2>
          <p className="text-sm text-gray-600">{currentReport.description}</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 mb-6">
        {(type === 'note_debit' || type === 'bordereau_reassureur') && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Cédante</label>
              <select
                value={formData.cedanteId}
                onChange={(e) => setFormData({ ...formData, cedanteId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Sélectionner...</option>
                {/* Options will be populated dynamically */}
              </select>
            </div>
            {type === 'bordereau_reassureur' && (
              <div>
                <label className="block text-sm font-medium mb-1">Réassureur</label>
                <select
                  value={formData.reassureurId}
                  onChange={(e) => setFormData({ ...formData, reassureurId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Sélectionner...</option>
                  {/* Options will be populated dynamically */}
                </select>
              </div>
            )}
          </>
        )}

        {type === 'treaty_statement' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date Début</label>
                <input
                  type="date"
                  value={formData.dateDebut}
                  onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Fin</label>
                <input
                  type="date"
                  value={formData.dateFin}
                  onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Période</label>
              <select
                value={formData.periode}
                onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Q1-2024">Q1 2024</option>
                <option value="Q2-2024">Q2 2024</option>
                <option value="Q3-2024">Q3 2024</option>
                <option value="Q4-2024">Q4 2024</option>
                <option value="2024">Année 2024</option>
              </select>
            </div>
          </>
        )}

        {(type === 'note_debit' || type === 'bordereau_reassureur') && (
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.includeAmountInWords}
                onChange={(e) => setFormData({ ...formData, includeAmountInWords: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Inclure le montant en lettres (requis légalement)</span>
            </label>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={generateReport}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <FileText size={18} />
        {loading ? 'Génération en cours...' : 'Générer le Rapport'}
      </button>

      {/* Preview */}
      {pdfUrl && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Aperçu</h3>
            <div className="flex gap-2">
              <button
                onClick={printReport}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Printer size={16} />
                Imprimer
              </button>
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download size={16} />
                Télécharger
              </button>
            </div>
          </div>
          <iframe src={pdfUrl} className="w-full h-[600px] border rounded-lg" />
        </div>
      )}

      {/* Template Info */}
      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
        <h4 className="font-semibold mb-2">Informations du Template</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          {type === 'note_debit' && (
            <>
              <li>• Logo ARS en en-tête</li>
              <li>• Tableau: Couverture / Période / Capitaux / Prime</li>
              <li>• Section déductions (R/I Commission)</li>
              <li>• Prime Nette en gras</li>
              <li>• Montant en lettres (ex: "CENT QUARANTE HUIT DINARS, 994 MILLIMES")</li>
              <li>• "SOLDE EN FAVEUR AON TUNISIE"</li>
            </>
          )}
          {type === 'bordereau_reassureur' && (
            <>
              <li>• Même structure que Note de Débit</li>
              <li>• Nom du réassureur affiché</li>
              <li>• Part spécifique du réassureur (Order %)</li>
              <li>• Prime pour l'ordre calculée</li>
              <li>• "SOLDE EN FAVEUR [RÉASSUREUR NAME]"</li>
            </>
          )}
          {type === 'treaty_statement' && (
            <>
              <li>• Header: Reinsured / Reinsurer / Broker / Currency / Period</li>
              <li>• Colonnes DEBIT: R/I Comm, Paid Losses, Prem Rves Ret, Loss Rves Ret, Profit Comm, Taxes, Brokerage</li>
              <li>• Colonnes CREDIT: Ceded Prem, Prem Rves Rel, Loss Rves Rel, Interests</li>
              <li>• Colonne BALANCE (solde final)</li>
              <li>• Sous-totaux par branche (Fire, Engineering, Marine, etc.)</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
