import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';
import { CedanteContact, CreateCedanteContactDto } from '../../types/cedante.types';

interface CedanteContactModalProps {
  cedanteId: string;
  // FIX: needs the full existing contacts list — the backend has no per-contact
  // route (see master-data.api.ts note). The only real way to change a contact is
  // CedantesService.update(), which replaces the ENTIRE contacts array in one shot
  // (deleteMany + create). This modal now builds that full array itself.
  existingContacts: CedanteContact[];
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
}

export default function CedanteContactModal({ cedanteId, existingContacts, contact, onClose }: CedanteContactModalProps) {
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
      };
    }

    return {
      nom: '',
      prenom: '',
      poste: '',
      telephoneFixe: '',
      telephoneMobile: '',
      email: '',
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // FIX: routes through cedantesApi.update() with the full contacts array
  // instead of the nonexistent addContact/updateContact endpoints.
  const mutation = useMutation({
    mutationFn: (nextContacts: CreateCedanteContactDto[]) =>
      cedantesApi.update(cedanteId, { contacts: nextContacts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId] });
      onClose();
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message });
      } else {
        setErrors({ submit: 'Erreur lors de l\'enregistrement du contact.' });
      }
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
      setErrors({ email: 'Format d\'email invalide' });
      return;
    }

    // Strip id/cedanteId/timestamps — the backend recreates every row fresh on
    // each update() call, so only the DTO-shaped fields matter.
    const toDto = (c: CedanteContact): CreateCedanteContactDto => ({
      nom: c.nom,
      prenom: c.prenom,
      poste: c.poste,
      telephoneFixe: c.telephoneFixe,
      telephoneMobile: c.telephoneMobile,
      email: c.email,
    });

    const editedDto: CreateCedanteContactDto = { ...formData };

    let nextContacts: CreateCedanteContactDto[];
    if (contact) {
      // Editing — replace this one entry, keep every other contact as-is.
      nextContacts = existingContacts.map((c) => (c.id === contact.id ? editedDto : toDto(c)));
    } else {
      // Adding — keep every existing contact, append the new one.
      nextContacts = [...existingContacts.map(toDto), editedDto];
    }

    mutation.mutate(nextContacts);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-border bg-card shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-[18px] font-semibold text-foreground">
            {contact ? 'Modifier le contact' : 'Nouveau contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-[13px] text-destructive">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Nom <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom || ''}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border ${errors.nom ? 'border-destructive' : 'border-border'} bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
              {errors.nom && <p className="mt-1 text-[11px] text-destructive">{errors.nom}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Prénom</label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Poste / Fonction</label>
              <input
                type="text"
                name="poste"
                value={formData.poste || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Téléphone fixe</label>
              <input
                type="tel"
                name="telephoneFixe"
                value={formData.telephoneFixe || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Mobile</label>
              <input
                type="tel"
                name="telephoneMobile"
                value={formData.telephoneMobile || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className={`w-full px-3 py-2 border ${errors.email ? 'border-destructive' : 'border-border'} bg-secondary text-foreground rounded-lg text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
              {errors.email && (
                <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}