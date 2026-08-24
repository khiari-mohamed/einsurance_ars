import { useNavigate } from 'react-router-dom';
import { Info, ArrowRight, Download } from 'lucide-react';

// FIX (Comptabilité pass): deliberately NOT a fabricated Bilan (actif/
// passif). Per the CDC's own scope for this module (§ Fenêtres de
// l'application: génération d'écriture + fichier d'intégration only) and
// the accompanying description, statutory accounting (including the
// balance sheet) lives in ARS's separate accounting software, fed by this
// module's export. Building a Bilan off this 10-account seed chart — with
// no immobilisations/capitaux propres structure — would produce numbers
// that look official but aren't grounded in real data. This panel is
// honest about that boundary and routes to what IS real: the export, and
// the compte de résultat (which the trial balance genuinely supports).
export default function BalanceSheet() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bilan</h1>
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="text-primary shrink-0 mt-0.5" size={22} />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-1">Le bilan (actif/passif) n'est pas produit par ce module.</p>
            <p>
              Selon le cahier des charges, ARS Réassurance gère les écritures techniques (génération, validation) et
              produit un fichier d'intégration exporté vers le logiciel comptable dédié — c'est ce dernier qui
              établit les états financiers statutaires, dont le bilan.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button onClick={() => navigate('/comptabilite/profit-loss')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-primary hover:bg-muted">
            Voir le Compte de Résultat <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('/comptabilite/export')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Download size={16} /> Fichier d'intégration
          </button>
        </div>
      </div>
    </div>
  );
}