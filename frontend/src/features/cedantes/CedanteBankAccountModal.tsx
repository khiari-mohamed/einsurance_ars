import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';
import { CedanteBankAccount, CreateCedanteBankAccountDto } from '../../types/cedante.types';

interface CedanteBankAccountModalProps {
  cedanteId: string;
  // Same reasoning as CedanteContactModal — no per-account route exists on the
  // backend (CedantesController only has GET/POST/PUT/:id/DELETE + bulk +
  // override-code). BankAccounts are replaced wholesale via update().
  existingBankAccounts: CedanteBankAccount[];
  bankAccount: CedanteBankAccount | null;
  onClose: () => void;
}

interface BankAccountFormData {
  banque: string;
  agence: string;
  rib: string;
  iban: string;
  swift: string;
  currency: string;
  isDefault: boolean;
}

const CURRENCIES = ['TND', 'USD', 'EUR', 'GBP'];

export default function CedanteBankAccountModal({
  cedanteId,
  existingBankAccounts,
  bankAccount,
  onClose,
}: CedanteBankAccountModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BankAccountFormData>(() => {
    if (bankAccount) {
      return {
        banque: bankAccount.banque || '',
        agence: bankAccount.agence || '',
        rib: bankAccount.rib || '',
        iban: bankAccount.iban || '',
        swift: bankAccount.swift || '',
        currency: bankAccount.currency || 'TND',
        isDefault: bankAccount.isDefault || false,
      };
    }
    return {
      banque: '',
      agence: '',
      rib: '',
      iban: '',
      swift: '',
      currency: 'TND',
      isDefault: existingBankAccounts.length === 0, // first account defaults to principal
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (nextAccounts: CreateCedanteBankAccountDto[]) =>
      cedantesApi.update(cedanteId, { bankAccounts: nextAccounts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId] });
      onClose();
    },
    onError: (error: any) => {
      setErrors({ submit: error.response?.data?.message || "Erreur lors de l'enregistrement du compte bancaire." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.banque.trim()) {
      setErrors({ banque: 'La banque est obligatoire' });
      return;
    }
    if (!formData.rib.trim()) {
      setErrors({ rib: 'Le RIB est obligatoire' });
      return;
    }
    if (!formData.currency) {
      setErrors({ currency: 'La devise est obligatoire' });
      return;
    }

    const toDto = (b: CedanteBankAccount): CreateCedanteBankAccountDto => ({
      banque: b.banque,
      agence: b.agence,
      rib: b.rib,
      iban: b.iban,
      swift: b.swift,
      currency: b.currency,
      isDefault: b.isDefault,
    });

    // If this account is being marked as principal, un-mark every other one —
    // mirrors the intent of BankAccount.isDefault (one default per entity).
    const editedDto: CreateCedanteBankAccountDto = { ...formData };

    let nextAccounts: CreateCedanteBankAccountDto[];
    if (bankAccount) {
      nextAccounts = existingBankAccounts.map((b) => {
        if (b.id === bankAccount.id) return editedDto;
        const dto = toDto(b);
        return editedDto.isDefault ? { ...dto, isDefault: false } : dto;
      });
    } else {
      const rest = existingBankAccounts.map((b) => {
        const dto = toDto(b);
        return editedDto.isDefault ? { ...dto, isDefault: false } : dto;
      });
      nextAccounts = [...rest, editedDto];
    }

    mutation.mutate(nextAccounts);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {bankAccount ? 'Modifier le compte bancaire' : 'Nouveau compte bancaire'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Banque <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="banque"
                value={formData.banque}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.banque ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.banque && <p className="mt-1 text-[11px] text-red-500">{errors.banque}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Agence</label>
              <input
                type="text"
                name="agence"
                value={formData.agence}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                RIB <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="rib"
                value={formData.rib}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.rib ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.rib && <p className="mt-1 text-[11px] text-red-500">{errors.rib}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">IBAN</label>
              <input
                type="text"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                placeholder="Optionnel pour compte tunisien"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">SWIFT / BIC</label>
              <input
                type="text"
                name="swift"
                value={formData.swift}
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
                value={formData.currency}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.currency ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.currency && <p className="mt-1 text-[11px] text-red-500">{errors.currency}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[13px] font-medium text-gray-700">Compte principal</span>
              </label>
              <p className="mt-1 text-[11px] text-gray-400">
                Un seul compte principal par devise n'est pas imposé — cocher ceci décochera le principal existant.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}