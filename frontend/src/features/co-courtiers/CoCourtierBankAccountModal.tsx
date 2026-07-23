import { useState } from 'react';
import { X } from 'lucide-react';
import { CoCourtierBankAccount } from '../../types/co-courtier.types';

export interface BankAccountFormData {
  banque: string;
  agence?: string;
  rib: string;
  iban?: string;
  swift?: string;
  currency: string;
  isDefault?: boolean;
}

interface Props {
  account: CoCourtierBankAccount | null;
  // CDC §5.7 — "identique au Réassureur" — SWIFT/BIC obligatoire pour les
  // entités non-résidentes (§5.6.3). Passed down so the form can enforce it.
  courtierResident?: boolean;
  onSave: (data: BankAccountFormData) => void;
  onClose: () => void;
  isSaving?: boolean;
}

const SWIFT_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'JPY'];

export default function CoCourtierBankAccountModal({ account, courtierResident, onSave, onClose, isSaving }: Props) {
  const [form, setForm] = useState<BankAccountFormData>({
    banque: account?.banque || '',
    agence: account?.agence || '',
    rib: account?.rib || '',
    iban: account?.iban || '',
    swift: account?.swift || '',
    currency: account?.currency || 'TND',
    isDefault: account?.isDefault || false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      const nextValue = name === 'swift' ? value.toUpperCase() : value;
      setForm((prev) => ({ ...prev, [name]: nextValue }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.banque.trim()) nextErrors.banque = 'La banque est obligatoire.';
    if (!form.rib.trim() && !form.iban?.trim()) nextErrors.rib = 'RIB ou IBAN requis.';
    if (courtierResident === false && !form.swift?.trim()) {
      nextErrors.swift = 'SWIFT/BIC obligatoire pour une entité non-résidente.';
    }
    if (form.swift && !SWIFT_REGEX.test(form.swift)) {
      nextErrors.swift = 'Format SWIFT invalide (ex: BNPAFRPPXXX).';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[16px] font-semibold text-gray-900">
            {account ? 'Modifier le compte' : 'Nouveau compte bancaire'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Banque <span className="text-red-500">*</span>
              </label>
              <input
                name="banque"
                value={form.banque}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.banque ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.banque && <p className="mt-1 text-[11px] text-red-500">{errors.banque}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Agence</label>
              <input
                name="agence"
                value={form.agence}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Devise <span className="text-red-500">*</span>
              </label>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">RIB</label>
              <input
                name="rib"
                value={form.rib}
                onChange={handleChange}
                className={`w-full px-3 py-2 border ${errors.rib ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.rib && <p className="mt-1 text-[11px] text-red-500">{errors.rib}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">IBAN</label>
              <input
                name="iban"
                value={form.iban}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                SWIFT / BIC {courtierResident === false && <span className="text-red-500">*</span>}
              </label>
              <input
                name="swift"
                value={form.swift}
                onChange={handleChange}
                placeholder="BNPAFRPPXXX"
                className={`w-full px-3 py-2 border ${errors.swift ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.swift && <p className="mt-1 text-[11px] text-red-500">{errors.swift}</p>}
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                name="isDefault"
                checked={form.isDefault}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-[13px] text-gray-700">Compte par défaut pour cette devise</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}