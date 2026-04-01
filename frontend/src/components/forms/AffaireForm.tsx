import { useState } from 'react';

export default function AffaireForm({ onSubmit, onCancel }: any) {
  const [step, setStep] = useState(1);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-2 mx-1 rounded ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span>Informations Générales</span>
          <span>Données Financières</span>
          <span>Réassureurs</span>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Informations Générales</h3>
          <input type="text" placeholder="N° Affaire" className="w-full px-4 py-2 border rounded" />
          <input type="text" placeholder="Assuré" className="w-full px-4 py-2 border rounded" />
          <input type="text" placeholder="Cédante" className="w-full px-4 py-2 border rounded" />
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
          Annuler
        </button>
        <div className="space-x-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2 border rounded hover:bg-gray-50">
              Précédent
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Suivant
            </button>
          ) : (
            <button onClick={onSubmit} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Créer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
