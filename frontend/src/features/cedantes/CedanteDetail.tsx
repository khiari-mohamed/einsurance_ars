import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, CreditCard, FileText, FileCheck, Shield, Globe } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';
import { affairesApi } from '../../api/affaires.api';
import { Cedante, CedanteContact, CedanteBankAccount } from '../../types/cedante.types';
import CedanteContactModal from './CedanteContactModal';

export default function CedanteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CedanteContact | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');

  const { data: cedante, isLoading } = useQuery({
    queryKey: ['cedantes', id],
    queryFn: async () => {
      const { data } = await cedantesApi.getOne(id!);
      return data;
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['cedantes', id, 'contracts'],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({ cedanteId: id, limit: 100 });
      return data.data || data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => cedantesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes'] });
      navigate('/cedantes');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => cedantesApi.deleteContact(id!, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id] });
    },
  });

  const overrideCodeMutation = useMutation({
    mutationFn: (code: string) => cedantesApi.overrideCode(id!, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id] });
      setIsOverrideModalOpen(false);
      setNewCode('');
    },
  });

  // FIX: relabeled "Supprimer" -> "Désactiver" — this is a soft deactivation
  // (isActive: false, guarded by active-affaire checks server-side), same as the list
  // page fix. Copy now matches what actually happens.
  const handleDeactivate = () => {
    setConfirmState({
      type: 'deactivate',
      message: 'Désactiver cette compagnie d\'assurances ? Elle restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.',
      onConfirm: () => {
        deleteMutation.mutate();
        setConfirmState({ type: null });
      },
    });
  };

  const handleDeleteContact = (contactId: string) => {
    setConfirmState({
      type: 'delete-contact',
      message: 'Êtes-vous sûr de vouloir supprimer ce contact ?',
      onConfirm: () => {
        deleteContactMutation.mutate(contactId);
        setConfirmState({ type: null });
      },
    });
  };

  const handleOverrideCode = () => {
    if (!newCode.match(/^CAS-[0-9]{4}$/)) {
      alert('Le code doit être au format CAS-XXXX (ex: CAS-0042)');
      return;
    }
    setConfirmState({
      type: 'override-code',
      message: `Confirmer le changement de code vers ${newCode} ?`,
      onConfirm: () => {
        overrideCodeMutation.mutate(newCode);
        setConfirmState({ type: null });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!cedante) {
    return (
      <div className="p-6 text-center text-gray-500">
        Compagnie d'assurances non trouvée
      </div>
    );
  }

  const isAdmin = true; // TODO: Get from user context — see usePermissions.ts review

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/cedantes')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">{cedante.raisonSociale}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[13px] text-gray-500">Code: {cedante.code}</p>
              {cedante.oldCode && (
                <p className="text-[11px] text-gray-400">Ancien code: {cedante.oldCode}</p>
              )}
              {cedante.codeModifiedAt && (
                <p className="text-[11px] text-gray-400">
                  Modifié le {new Date(cedante.codeModifiedAt).toLocaleDateString()}
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
          {cedante.isActive !== false && (
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
          {/* Onglet 1: Informations Générales */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Raison Sociale" value={cedante.raisonSociale} />
              <InfoField label="Code" value={cedante.code} />
              <InfoField label="Compte Comptable" value={cedante.compteComptable} />
              <InfoField label="Forme Juridique" value={cedante.formeJuridique} />
              <InfoField label="Identifiant Unique" value={cedante.identifiantUnique || 'À renseigner'} />
              <InfoField
                label="Résident"
                value={cedante.resident ? 'Oui (Tunisien)' : 'Non (Étranger)'}
                icon={cedante.resident ? <Shield size={14} /> : <Globe size={14} />}
              />
              <InfoField label="RNE (legacy)" value={cedante.rne || '-'} />
              <InfoField label="Pays" value={cedante.pays || '-'} />
              <InfoField label="Adresse" value={cedante.adresse || '-'} className="md:col-span-2" />
              <InfoField label="Capital" value={cedante.capital ? `${cedante.capital} TND` : '-'} />
            </div>
            {cedante.freeFields && Object.keys(cedante.freeFields).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-[12px] font-medium text-gray-500 mb-2">Champs libres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(cedante.freeFields).map(([key, value]) => (
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
            {cedante.contacts && cedante.contacts.length > 0 ? (
              <div className="space-y-3">
                {cedante.contacts.map((contact: CedanteContact) => (
                  <div key={contact.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">
                          {contact.prenom} {contact.nom}
                          {/* NOTE: isDefault display kept — flagged in review, needs
                              backend confirmation (see intro). Renders fine either way. */}
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
                    {/* FIX: was contact.telephone (field doesn't exist on the
                        corrected CedanteContact type) — now telephoneFixe /
                        telephoneMobile, matching the backend Contact model. */}
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
              {/* FIX: this button previously set isBankModalOpen/editingBank state
                  but no modal was ever rendered anywhere in the file — clicking it
                  silently did nothing, which reads as broken rather than
                  unimplemented. Disabled with an explicit label until the bank
                  account modal component exists. */}
              <button
                disabled
                title="Modal de compte bancaire pas encore disponible"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed"
              >
                <Plus size={16} />
                Ajouter (bientôt)
              </button>
            </div>
            {cedante.bankAccounts && cedante.bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {cedante.bankAccounts.map((bank: CedanteBankAccount) => (
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
                          {/* FIX: iban field existed on the type but was never
                              rendered — real cédante/réassureur data increasingly
                              includes IBAN separately from RIB (audit Découverte 3). */}
                          {bank.iban && (
                            <p className="text-[12px] text-gray-600 col-span-2">IBAN: {bank.iban}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled
                          title="Modal de compte bancaire pas encore disponible"
                          className="p-1 rounded text-gray-300 cursor-not-allowed"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun compte bancaire</p>
            )}
          </div>

          {cedante.freeFields?.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Notes
              </h2>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{cedante.freeFields.notes}</p>
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
                <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${cedante.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {cedante.isActive ? 'Oui' : 'Non'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-600">Compte verrouillé</span>
                <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${cedante.isAccountLocked ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {cedante.isAccountLocked ? 'Verrouillé' : 'Déverrouillé'}
                </span>
              </div>
              {cedante.codeModifiedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">Code modifié par</span>
                  <span className="text-[13px] text-gray-900">{cedante.codeModifiedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contrats */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck size={18} />
                Contrats
              </h2>
            </div>
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    onClick={() => navigate(`/affaires/${contract.id}`)}
                    className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <p className="text-[13px] font-medium text-gray-900">{contract.numeroPolice || contract.reference}</p>
                    <p className="text-[11px] text-gray-500">{contract.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun contrat</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.type !== null}
        title={confirmState.type === 'deactivate' ? 'Désactivation' : confirmState.type === 'delete-contact' ? 'Suppression' : 'Confirmation'}
        message={confirmState.message || ''}
        confirmLabel="Confirmer"
        confirmVariant="danger"
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ type: null })}
      />

      {/* Contact Modal */}
      {isContactModalOpen && (
        <CedanteContactModal
          cedanteId={id!}
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
              <p className="text-[13px] text-gray-500 mt-1">Format: CAS-XXXX (ex: CAS-0042)</p>
            </div>
            <div className="p-6">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nouveau code</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="CAS-0001"
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