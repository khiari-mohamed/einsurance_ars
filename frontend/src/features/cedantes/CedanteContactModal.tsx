import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';
import { CedanteContact } from '../../types/cedante.types';

interface CedanteContactModalProps {
  cedanteId: string;
  contact: CedanteContact | null;
  onClose: () => void;
}

interface CedanteContactFormData {
  nom: string;
  prenom: string;
  poste: string;
  telephoneFixe: string;
  telephoneMobile: string;
  email: string;
  isDefault: boolean;
}

export default function CedanteContactModal({ cedanteId, contact, onClose }: CedanteContactModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CedanteContactFormData>(() => {
    if (contact) {
      return {
        nom: contact.nom || '',
        prenom: contact.prenom || '',
        poste: contact.poste || '',
        telephoneFixe: contact.telephoneFixe || '',
        telephoneMobile: contact.telephoneMobile || '',
        email: contact.email || '',
        isDefault: contact.isDefault || false,
      };
    }

    return {
      nom: '',
      prenom: '',
      poste: '',
      telephoneFixe: '',
      telephoneMobile: '',
      email: '',
      isDefault: false,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: Partial<CedanteContact> & { isDefault?: boolean }) => {
      if (contact) {
        return cedantesApi.updateContact(cedanteId, contact.id, data);
      }
      return cedantesApi.addContact(cedanteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId] });
      onClose();
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: 'Format d\'email invalide' });
      return;
    }

    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value } as CedanteContactFormData);
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {contact ? 'Modifier le contact' : 'Nouveau contact'}
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
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom || ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prénom</label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Poste / Fonction</label>
              <input
                type="text"
                name="poste"
                value={formData.poste || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* FIX: split into two fields matching telephoneFixe / telephoneMobile */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Téléphone fixe</label>
              <input
                type="tel"
                name="telephoneFixe"
                value={formData.telephoneFixe || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mobile</label>
              <input
                type="tel"
                name="telephoneMobile"
                value={formData.telephoneMobile || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.email && (
                <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>
              )}
            </div>

            {/* NOTE: isDefault checkbox kept — needs backend confirmation, see
                CedanteDetail.tsx / review response. */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault || false}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[13px] font-medium text-gray-700">Contact principal</span>
              </label>
              <p className="mt-1 text-[11px] text-gray-400">Le contact principal sera affiché en premier</p>
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