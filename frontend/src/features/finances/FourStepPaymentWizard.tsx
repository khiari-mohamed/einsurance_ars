import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, DollarSign, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface FourStepPaymentWizardProps {
  affaireId: string;
  affaireNumero: string;
  assure: { id: string; raisonSociale: string };
  cedante: { id: string; raisonSociale: string };
  reassureurs: Array<{ id: string; raisonSociale: string; share: number; netAmount: number }>;
  prime100: number;
  primeCedee: number;
  commissionCedante: number;
  devise: string;
}

interface StepData {
  montant: number;
  date: string;
  reference: string;
  modePaiement: string;
  banque: string;
  notes: string;
}

export default function FourStepPaymentWizard({
  affaireId,
  affaireNumero,
  assure,
  cedante,
  reassureurs,
  prime100,
  primeCedee,
  commissionCedante,
  devise,
}: FourStepPaymentWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [step1, setStep1] = useState<StepData>({
    montant: prime100,
    date: new Date().toISOString().split('T')[0],
    reference: `ENC-${affaireNumero}-01`,
    modePaiement: 'virement',
    banque: '',
    notes: '',
  });

  const [step2, setStep2] = useState<StepData>({
    montant: prime100,
    date: new Date().toISOString().split('T')[0],
    reference: `DEC-${affaireNumero}-01`,
    modePaiement: 'virement',
    banque: '',
    notes: '',
  });

  const [step3, setStep3] = useState<StepData>({
    montant: primeCedee - commissionCedante,
    date: new Date().toISOString().split('T')[0],
    reference: `ENC-${affaireNumero}-02`,
    modePaiement: 'virement',
    banque: '',
    notes: '',
  });

  const [step4, setStep4] = useState<StepData[]>(
    reassureurs.map((r, idx) => ({
      montant: r.netAmount,
      date: new Date().toISOString().split('T')[0],
      reference: `DEC-${affaireNumero}-R${idx + 1}`,
      modePaiement: 'swift',
      banque: '',
      notes: '',
    }))
  );

  const steps = [
    {
      number: 1,
      title: 'Encaissement Assuré',
      description: `Recevoir ${prime100.toFixed(2)} ${devise} de ${assure.raisonSociale}`,
      icon: Users,
      color: 'blue',
    },
    {
      number: 2,
      title: 'Paiement Cédante',
      description: `Payer ${prime100.toFixed(2)} ${devise} à ${cedante.raisonSociale}`,
      icon: Building2,
      color: 'orange',
    },
    {
      number: 3,
      title: 'Encaissement Net',
      description: `Recevoir ${(primeCedee - commissionCedante).toFixed(2)} ${devise} de ${cedante.raisonSociale}`,
      icon: DollarSign,
      color: 'green',
    },
    {
      number: 4,
      title: 'Paiement Réassureurs',
      description: `Payer ${reassureurs.length} réassureur(s)`,
      icon: Building2,
      color: 'purple',
    },
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Step 1: Encaissement from Assuré
      await fetch('/api/finances/encaissements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affaireId,
          sourceType: 'client',
          clientId: assure.id,
          ...step1,
        }),
      });

      // Step 2: Décaissement to Cédante
      await fetch('/api/finances/decaissements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affaireId,
          destinationType: 'cedante',
          cedanteId: cedante.id,
          ...step2,
        }),
      });

      // Step 3: Encaissement from Cédante
      await fetch('/api/finances/encaissements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affaireId,
          sourceType: 'cedante',
          cedanteId: cedante.id,
          ...step3,
        }),
      });

      // Step 4: Décaissement to Réassureurs
      for (let i = 0; i < reassureurs.length; i++) {
        await fetch('/api/finances/decaissements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affaireId,
            destinationType: 'reassureur',
            reassureurId: reassureurs[i].id,
            ...step4[i],
          }),
        });
      }

      toast.success('Flux de paiement 4 étapes enregistré avec succès');
      navigate('/finances');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const renderStepForm = () => {
    const currentData = currentStep === 1 ? step1 : currentStep === 2 ? step2 : currentStep === 3 ? step3 : null;
    const setCurrentData = currentStep === 1 ? setStep1 : currentStep === 2 ? setStep2 : currentStep === 3 ? setStep3 : null;

    if (currentStep === 4) {
      return (
        <div className="space-y-4">
          {reassureurs.map((r, idx) => (
            <div key={r.id} className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-3">{r.raisonSociale} ({r.share}%)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Montant</label>
                  <input
                    type="number"
                    value={step4[idx].montant}
                    onChange={(e) => {
                      const newStep4 = [...step4];
                      newStep4[idx].montant = parseFloat(e.target.value);
                      setStep4(newStep4);
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={step4[idx].date}
                    onChange={(e) => {
                      const newStep4 = [...step4];
                      newStep4[idx].date = e.target.value;
                      setStep4(newStep4);
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Référence</label>
                  <input
                    type="text"
                    value={step4[idx].reference}
                    onChange={(e) => {
                      const newStep4 = [...step4];
                      newStep4[idx].reference = e.target.value;
                      setStep4(newStep4);
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mode</label>
                  <select
                    value={step4[idx].modePaiement}
                    onChange={(e) => {
                      const newStep4 = [...step4];
                      newStep4[idx].modePaiement = e.target.value;
                      setStep4(newStep4);
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="swift">SWIFT</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!currentData || !setCurrentData) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Montant ({devise})</label>
            <input
              type="number"
              value={currentData.montant}
              onChange={(e) => setCurrentData({ ...currentData, montant: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={currentData.date}
              onChange={(e) => setCurrentData({ ...currentData, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Référence</label>
            <input
              type="text"
              value={currentData.reference}
              onChange={(e) => setCurrentData({ ...currentData, reference: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode de Paiement</label>
            <select
              value={currentData.modePaiement}
              onChange={(e) => setCurrentData({ ...currentData, modePaiement: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="swift">SWIFT</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Banque</label>
            <input
              type="text"
              value={currentData.banque}
              onChange={(e) => setCurrentData({ ...currentData, banque: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={currentData.notes}
              onChange={(e) => setCurrentData({ ...currentData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Flux de Paiement 4 Étapes - Client ARS</h2>
        <p className="text-gray-600 mb-8">Affaire: {affaireNumero}</p>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? `bg-${step.color}-500 text-white`
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                  </div>
                  <p className={`text-xs mt-2 text-center ${isActive ? 'font-semibold' : ''}`}>
                    {step.title}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-1 flex-1 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Content */}
        <div className="mb-8">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="font-medium">{steps[currentStep - 1].description}</p>
          </div>
          {renderStepForm()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Précédent
          </button>
          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Suivant
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Check size={16} />
              {loading ? 'Enregistrement...' : 'Terminer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
