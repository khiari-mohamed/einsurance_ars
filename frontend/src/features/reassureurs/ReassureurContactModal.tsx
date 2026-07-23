import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { reassureursApi } from '../../api/master-data.api';
import { ReassureurContact, CreateReassureurContactDto } from '../../types/reassureur.types';

interface ReassureurContactModalProps {
  reassureurId: string;
  // FIX: needs the full existing contacts list — ReassureursController has no
  // per-contact route. The only real way to change a contact is
  // ReassureursService.update(), which replaces the ENTIRE contacts array in one
  // shot (deleteMany + create). Mirrors CedanteContactModal exactly.
  existingContacts: ReassureurContact[];
  contact: ReassureurContact | null;
  onClose: () => void;
}

interface ContactFormData {
  nom: string;
  prenom: string;
  poste: string;
  telephoneFixe: string;
  telephoneMobile: string;
  email: string;
}

export default function ReassureurContactModal({ reassureurId, existingContacts, contact, onClose }: ReassureurContactModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ContactFormData>(() => {
    if (contact) {
      return {
        nom: contact.nom || '',
        prenom: contact.prenom || '',
        poste: contact.poste || '',
        telephoneFixe: contact.telephoneFixe || '',
        telephoneMobile: contact.telephoneMobile || '',
        email: contact.email || '',
      };
    }
    return { nom: '', prenom: '', poste: '', telephoneFixe: '', telephoneMobile: '', email: '' };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (nextContacts: CreateReassureurContactDto[]) =>
      reassureursApi.update(reassureurId, { contacts: nextContacts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
      onClose();
    },
    onError: (error: any) => {
      setErrors({ submit: error.response?.data?.message || "Erreur lors de l'enregistrement du contact." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.nom.trim()) {
      setErrors({ nom: 'Le nom est obligatoire' });
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: "Format d'email invalide" });
      return;
    }

    const toDto = (c: ReassureurContact): CreateReassureurContactDto => ({
      nom: c.nom,
      prenom: c.prenom,
      poste: c.poste,
      telephoneFixe: c.telephoneFixe,
      telephoneMobile: c.telephoneMobile,
      email: c.email,
    });

    const editedDto: CreateReassureurContactDto = { ...formData };

    let nextContacts: CreateReassureurContactDto[];
    if (contact) {
      nextContacts = existingContacts.map((c) => (c.id === contact.id ? editedDto : toDto(c)));
    } else {
      nextContacts = [...existingContacts.map(toDto), editedDto];
    }

    mutation.mutate(nextContacts);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {contact ? 'Modifier le contact' : 'Nouveau contact'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
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
                value={formData.nom}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.nom ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.nom && <p className="mt-1 text-[11px] text-red-500">{errors.nom}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prénom</label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Poste / Fonction</label>
              <input
                type="text"
                name="poste"
                value={formData.poste}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Téléphone fixe</label>
              <input
                type="tel"
                name="telephoneFixe"
                value={formData.telephoneFixe}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mobile</label>
              <input
                type="tel"
                name="telephoneMobile"
                value={formData.telephoneMobile}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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