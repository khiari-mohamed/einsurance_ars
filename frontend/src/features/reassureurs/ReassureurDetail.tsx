import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, CreditCard, FileText, FileCheck, Shield, Globe, X } from 'lucide-react';
import { reassureursApi } from '../../api/master-data.api';
import { Reassureur, ReassureurContact, ReassureurBankAccount } from '../../types/reassureur.types';

export default function ReassureurDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ReassureurContact | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');

  const { data: reassureur, isLoading } = useQuery({
    queryKey: ['reassureurs', id],
    queryFn: async () => {
      const { data } = await reassureursApi.getOne(id!);
      return data;
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['reassureurs', id, 'contracts'],
    queryFn: async () => {
      const { data } = await reassureursApi.getParticipations(id!);
      return data.data || data || [];
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => reassureursApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs'] });
      navigate('/reassureurs');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => reassureursApi.deleteContact(id!, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', id] });
    },
  });

  const overrideCodeMutation = useMutation({
    mutationFn: (code: string) => reassureursApi.overrideCode(id!, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', id] });
      setIsOverrideModalOpen(false);
      setNewCode('');
    },
  });

  // FIX: relabeled "Supprimer" -> "Désactiver" — same rationale as CedanteDetail.
  const handleDeactivate = () => {
    if (window.confirm('Désactiver ce réassureur ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.')) {
      deleteMutation.mutate();
    }
  };

  const handleDeleteContact = (contactId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleOverrideCode = () => {
    if (!newCode.match(/^REA-[0-9]{4}$/)) {
      alert('Le code doit être au format REA-XXXX (ex: REA-0042)');
      return;
    }
    if (window.confirm(`Confirmer le changement de code vers ${newCode} ?`)) {
      overrideCodeMutation.mutate(newCode);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!reassureur) {
    return (
      <div className="p-6 text-center text-gray-500">
        Réassureur non trouvé
      </div>
    );
  }

  const isAdmin = true; // TODO: Get from user context

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reassureurs')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">{reassureur.raisonSociale}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[13px] text-gray-500">Code: {reassureur.code}</p>
              {reassureur.oldCode && (
                <p className="text-[11px] text-gray-400">Ancien code: {reassureur.oldCode}</p>
              )}
              {reassureur.codeModifiedAt && (
                <p className="text-[11px] text-gray-400">
                  Modifié le {new Date(reassureur.codeModifiedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setIsOverrideModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Edit2 size={16} />
              Modifier le code
            </button>
          )}
          {reassureur.isActive !== false && (
            <button
              onClick={handleDeactivate}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Désactiver
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations Générales */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Raison Sociale" value={reassureur.raisonSociale} />
              <InfoField label="Code" value={reassureur.code} />
              <InfoField label="Compte Comptable" value={reassureur.compteComptable} />
              <InfoField label="Forme Juridique" value={reassureur.formeJuridique} />
              <InfoField label="Identifiant Unique" value={reassureur.identifiantUnique || 'À renseigner'} />
              <InfoField
                label="Résident"
                value={reassureur.resident ? 'Oui (Tunisien)' : 'Non (Étranger)'}
                icon={reassureur.resident ? <Shield size={14} /> : <Globe size={14} />}
              />
              <InfoField label="RNE (legacy)" value={reassureur.rne || '-'} />
              <InfoField label="Pays" value={reassureur.pays || '-'} />
              <InfoField label="Adresse" value={reassureur.adresse || '-'} className="md:col-span-2" />
              <InfoField label="Capital" value={reassureur.capital ? `${reassureur.capital} TND` : '-'} />
            </div>
            {reassureur.freeFields && Object.keys(reassureur.freeFields).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-[12px] font-medium text-gray-500 mb-2">Champs libres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(reassureur.freeFields).map(([key, value]) => (
                    <InfoField key={key} label={key} value={String(value)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <Phone size={18} />
                Contacts
              </h2>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setIsContactModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {reassureur.contacts && reassureur.contacts.length > 0 ? (
              <div className="space-y-3">
                {reassureur.contacts.map((contact: ReassureurContact) => (
                  <div key={contact.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">
                          {contact.prenom} {contact.nom}
                          {contact.isDefault && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              Principal
                            </span>
                          )}
                        </p>
                        {contact.poste && (
                          <p className="text-[11px] text-gray-500">{contact.poste}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingContact(contact);
                            setIsContactModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {contact.email && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1 mb-1">
                        <Mail size={12} />
                        {contact.email}
                      </p>
                    )}
                    {/* FIX: telephone -> telephoneFixe / telephoneMobile */}
                    {contact.telephoneFixe && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1">
                        <Phone size={12} />
                        {contact.telephoneFixe} <span className="text-gray-400">(fixe)</span>
                      </p>
                    )}
                    {contact.telephoneMobile && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1">
                        <Phone size={12} />
                        {contact.telephoneMobile} <span className="text-gray-400">(mobile)</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun contact</p>
            )}
          </div>

          {/* Bank Accounts */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={18} />
                Coordonnées bancaires
              </h2>
            </div>
            {reassureur.bankAccounts && reassureur.bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {reassureur.bankAccounts.map((bank: ReassureurBankAccount) => (
                  <div key={bank.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-gray-900">
                          {bank.banque}
                          {bank.isDefault && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              Principal
                            </span>
                          )}
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                          <p className="text-[12px] text-gray-600">RIB: {bank.rib}</p>
                          <p className="text-[12px] text-gray-600">Devise: {bank.currency}</p>
                          {bank.swift && (
                            <p className="text-[12px] text-gray-600">SWIFT: {bank.swift}</p>
                          )}
                          {/* FIX: iban was on the type but never rendered */}
                          {bank.iban && (
                            <p className="text-[12px] text-gray-600">IBAN: {bank.iban}</p>
                          )}
                        </div>
                        {/* NOTE: no SWIFT shown here for a non-resident account is
                            EXPECTED now, not an error — SWIFT is a non-blocking
                            data-quality flag per the backend fix, not mandatory.
                            Consider a subtle "SWIFT manquant" badge here if you want
                            it surfaced visually, rather than silent absence. */}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun compte bancaire</p>
            )}
          </div>

          {reassureur.freeFields?.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Notes
              </h2>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{reassureur.freeFields.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Statut</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-600">Actif</span>
                <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${reassureur.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {reassureur.isActive ? 'Oui' : 'Non'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-600">Compte verrouillé</span>
                <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${reassureur.isAccountLocked ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {reassureur.isAccountLocked ? 'Verrouillé' : 'Déverrouillé'}
                </span>
              </div>
              {reassureur.codeModifiedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">Code modifié par</span>
                  <span className="text-[13px] text-gray-900">{reassureur.codeModifiedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Participations (Contrats) */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileCheck size={18} />
              Participations
            </h2>
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.map((participation: any) => {
                  const affaire = participation.affaire || participation;
                  return (
                    <div
                      key={participation.id}
                      onClick={() => affaire?.id && navigate(`/affaires/${affaire.id}`)}
                      className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <p className="text-[13px] font-medium text-gray-900">
                        {affaire?.numéroPolice || affaire?.numeroAffaire || affaire?.reference || 'Contrat'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-gray-500">
                          {affaire?.category || participation.type || 'N/A'}
                        </p>
                        <span className="text-[11px] font-semibold text-blue-600">
                          {participation.partPct != null ? `${participation.partPct}%` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucune participation</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {isContactModalOpen && (
        <ReassureurContactModal
          reassureurId={id!}
          contact={editingContact}
          onClose={() => {
            setIsContactModalOpen(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Override Code Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-[18px] font-semibold text-gray-900">Modifier le code</h2>
              <p className="text-[13px] text-gray-500 mt-1">Format: REA-XXXX (ex: REA-0042)</p>
            </div>
            <div className="p-6">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nouveau code</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="REA-0001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-[11px] text-amber-600 mt-2">
                ⚠️ Cette action est irréversible et sera enregistrée dans l'historique d'audit.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => {
                  setIsOverrideModalOpen(false);
                  setNewCode('');
                }}
                className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleOverrideCode}
                disabled={overrideCodeMutation.isPending}
                className="px-4 py-2 text-[13px] font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {overrideCodeMutation.isPending ? 'Modification...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  className?: string;
}

function InfoField({ label, value, icon, className = '' }: InfoFieldProps) {
  return (
    <div className={className}>
      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">{label}</p>
      <p className="text-[13px] text-gray-900 flex items-center gap-1.5">
        {icon}
        {value || '-'}
      </p>
    </div>
  );
}

interface ReassureurContactModalProps {
  reassureurId: string;
  contact: ReassureurContact | null;
  onClose: () => void;
}

function ReassureurContactModal({ reassureurId, contact, onClose }: ReassureurContactModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<ReassureurContact>>(
    contact || {
      nom: '',
      prenom: '',
      poste: '',
      // FIX: same split as CedanteContactModal.
      telephoneFixe: '',
      telephoneMobile: '',
      email: '',
      isDefault: false,
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: Partial<ReassureurContact>) => {
      if (contact) {
        return reassureursApi.updateContact(reassureurId, contact.id, data);
      }
      return reassureursApi.addContact(reassureurId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
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
      setErrors({ email: "Format d'email invalide" });
      return;
    }
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {contact ? 'Modifier le contact' : 'Nouveau contact'}
          </h2>
          {/* FIX (consistency): now uses the shared lucide-react X import instead
              of a hand-rolled inline <svg>. */}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{errors.submit}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
              <input type="text" name="nom" value={formData.nom || ''} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prénom</label>
              <input type="text" name="prenom" value={formData.prenom || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Poste / Fonction</label>
              <input type="text" name="poste" value={formData.poste || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* FIX: split telephone into telephoneFixe / telephoneMobile */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input type="tel" name="telephoneFixe" value={formData.telephoneFixe || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mobile</label>
              <input type="tel" name="telephoneMobile" value={formData.telephoneMobile || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500`} />
              {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isDefault" checked={formData.isDefault || false} onChange={handleChange} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                <span className="text-[13px] font-medium text-gray-700">Contact principal</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}