import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, CreditCard, FileText,
  FileCheck, Shield, Globe, Paperclip, Folder, Sliders, Download as DownloadIcon,
} from 'lucide-react';
import { cedantesApi, conventionsApi } from '../../api/master-data.api';
import { affairesApi } from '../../api/affaires.api';
import {
  Cedante, CedanteContact, CedanteBankAccount,
  CreateCedanteContactDto, CreateCedanteBankAccountDto,
} from '../../types/cedante.types';
import { Convention } from '../../types/convention.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import CedanteContactModal from './CedanteContactModal';
import CedanteBankAccountModal from './CedanteBankAccountModal';
import CedanteConventionModal from './CedanteConventionModal';
import CedanteFreeFieldsModal from './CedanteFreeFieldsModal';

// FIX: this type + useState was used all over the component (handleDeactivate,
// handleDeleteContact, handleOverrideCode, and the final <ConfirmDialog> render)
// but was NEVER DECLARED — every one of those handlers threw a ReferenceError at
// runtime the moment it was called, and the ConfirmDialog itself couldn't render.
// This was the single blocking bug in the file.
interface ConfirmState {
  type: 'deactivate' | 'delete-contact' | 'delete-bank-account' | 'deactivate-convention' | 'override-code' | null;
  message?: string;
  onConfirm?: () => void;
}

export default function CedanteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CedanteContact | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<CedanteBankAccount | null>(null);
  const [isConventionModalOpen, setIsConventionModalOpen] = useState(false);
  const [isFreeFieldsModalOpen, setIsFreeFieldsModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState>({ type: null });

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

  // FIX (new): Onglet 3 — Conventions (CDC §5.7: "Pièce jointe GED (convention
  // signée obligatoire), Date de signature, Date d'effet, Notes") was entirely
  // absent from the UI even though ConventionsController/Service fully support
  // it. listForPartner() only returns isActive: true conventions (backend-side
  // filter), matching the historized-conventions decision from §5.6.2.
  const { data: conventions = [] } = useQuery({
    queryKey: ['cedantes', id, 'conventions'],
    queryFn: async () => {
      const { data } = await conventionsApi.listForPartner('CEDANTE', id!);
      return data;
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

  // FIX: was cedantesApi.deleteContact(id, contactId) — that route doesn't exist
  // on the backend (see master-data.api.ts). The only real way to remove a contact
  // is to submit the full contacts array minus this one via update().
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => {
      const remaining: CreateCedanteContactDto[] = (cedante?.contacts || [])
        .filter((c) => c.id !== contactId)
        .map((c) => ({
          nom: c.nom,
          prenom: c.prenom,
          poste: c.poste,
          telephoneFixe: c.telephoneFixe,
          telephoneMobile: c.telephoneMobile,
          email: c.email,
        }));
      return cedantesApi.update(id!, { contacts: remaining });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id] });
    },
  });

  // FIX (new): bank account deletion — same full-array-replace pattern, previously
  // impossible entirely since no delete path existed for bank accounts at all.
  const deleteBankAccountMutation = useMutation({
    mutationFn: (bankId: string) => {
      const remaining: CreateCedanteBankAccountDto[] = (cedante?.bankAccounts || [])
        .filter((b) => b.id !== bankId)
        .map((b) => ({
          banque: b.banque,
          agence: b.agence,
          rib: b.rib,
          iban: b.iban,
          swift: b.swift,
          currency: b.currency,
          isDefault: b.isDefault,
        }));
      return cedantesApi.update(id!, { bankAccounts: remaining });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id] });
    },
  });

  // FIX (new): conventions have their own dedicated soft-delete route
  // (DELETE /master-data/conventions/:id, sets isActive: false) — unlike
  // contacts/bank accounts, this one actually exists on the backend.
  const deactivateConventionMutation = useMutation({
    mutationFn: (conventionId: string) => conventionsApi.deactivate(conventionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id, 'conventions'] });
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

  const handleDeleteBankAccount = (bankId: string) => {
    setConfirmState({
      type: 'delete-bank-account',
      message: 'Êtes-vous sûr de vouloir supprimer ce compte bancaire ?',
      onConfirm: () => {
        deleteBankAccountMutation.mutate(bankId);
        setConfirmState({ type: null });
      },
    });
  };

  const handleDeactivateConvention = (conventionId: string) => {
    setConfirmState({
      type: 'deactivate-convention',
      message: 'Désactiver cette convention ? Elle ne sera plus affichée dans la liste active mais restera conservée (durée légale de conservation).',
      onConfirm: () => {
        deactivateConventionMutation.mutate(conventionId);
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
              {/* FIX: was permanently disabled ("bientôt") — CedanteBankAccountModal
                  now exists and follows the same update()-based pattern as contacts. */}
              <button
                onClick={() => {
                  setEditingBank(null);
                  setIsBankModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Ajouter
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
                          {bank.iban && (
                            <p className="text-[12px] text-gray-600 col-span-2">IBAN: {bank.iban}</p>
                          )}
                          {bank.swift && (
                            <p className="text-[12px] text-gray-600 col-span-2">SWIFT: {bank.swift}</p>
                          )}
                          {bank.agence && (
                            <p className="text-[12px] text-gray-600 col-span-2">Agence: {bank.agence}</p>
                          )}
                        </div>
                      </div>
                      {/* FIX: edit/delete were both dead (edit disabled with no
                          modal, delete never existed) — both now wired. */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingBank(bank);
                            setIsBankModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBankAccount(bank.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                        >
                          <Trash2 size={14} />
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

          {/* FIX (new): Onglet 3 — Conventions. Was completely absent from the UI
              even though ConventionsController/Service fully support it (see
              master-data.api.ts conventionsApi). */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <Paperclip size={18} />
                Conventions
              </h2>
              <button
                onClick={() => setIsConventionModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {conventions.length > 0 ? (
              <div className="space-y-3">
                {conventions.map((convention: Convention) => (
                  <div key={convention.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 flex items-center gap-1.5 truncate">
                          <FileText size={14} className="shrink-0 text-gray-400" />
                          {convention.document?.originalName || convention.document?.nom || 'Document sans nom'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {convention.dateSignature && (
                            <span className="text-[11px] text-gray-500">
                              Signée le {new Date(convention.dateSignature).toLocaleDateString()}
                            </span>
                          )}
                          {convention.dateEffet && (
                            <span className="text-[11px] text-gray-500">
                              Effet le {new Date(convention.dateEffet).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {convention.notes && (
                          <p className="text-[12px] text-gray-600 mt-1.5 whitespace-pre-wrap">{convention.notes}</p>
                        )}
                      </div>
                      {/* NOTE: no download link — Document.filePath is a server-side
                          path/key, not a public URL, and no document-download route
                          was provided in this review. Add one here once that route
                          is confirmed. */}
                      <button
                        onClick={() => handleDeactivateConvention(convention.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 shrink-0 ml-2"
                        title="Désactiver cette convention"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucune convention</p>
            )}
          </div>

          {/* FIX (new): read-only GED (Documents) list — CedantesService.findOne()
              already includes `documents: { where: { entityType: 'CEDANTE' },
              include: { document: true } }`, but nothing rendered it. No generic
              upload endpoint was provided in this review (only the Conventions
              upload flow above is confirmed), so this stays display-only. Since
              ConventionsService.attach() routes through GedService.upload() with
              entityType: 'CEDANTE', a convention's document may also show up here
              depending on what GedService does internally — this is flagged rather
              than assumed, since ged.service.ts wasn't part of this review. */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Folder size={18} />
              Documents (GED)
            </h2>
            {cedante.documents && cedante.documents.length > 0 ? (
              <div className="space-y-2">
                {cedante.documents.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-900 truncate">
                          {link.document?.originalName || link.document?.nom}
                        </p>
                        {link.document?.documentType && (
                          <p className="text-[11px] text-gray-400">{link.document.documentType}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun document</p>
            )}
          </div>

          {/* FIX: Onglet 5 — Champs libres was read-only (no way to add/edit a
              field, and the section only rendered at all if freeFields already had
              entries). Now a dedicated, always-visible card with an edit modal —
              matches CDC §5.7 "Champs libres configurables". */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <Sliders size={18} />
                Champs libres
              </h2>
              <button
                onClick={() => setIsFreeFieldsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 size={14} />
                Modifier
              </button>
            </div>
            {cedante.freeFields && Object.keys(cedante.freeFields).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(cedante.freeFields).map(([key, value]) => (
                  <InfoField key={key} label={key} value={String(value)} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun champ libre défini</p>
            )}
          </div>
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
        title={
          confirmState.type === 'deactivate'
            ? 'Désactivation'
            : confirmState.type === 'delete-contact'
            ? 'Suppression du contact'
            : confirmState.type === 'delete-bank-account'
            ? 'Suppression du compte bancaire'
            : confirmState.type === 'deactivate-convention'
            ? 'Désactivation de la convention'
            : confirmState.type === 'override-code'
            ? 'Modification du code'
            : 'Confirmation'
        }
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
          existingContacts={cedante.contacts || []}
          contact={editingContact}
          onClose={() => {
            setIsContactModalOpen(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Bank Account Modal */}
      {isBankModalOpen && (
        <CedanteBankAccountModal
          cedanteId={id!}
          existingBankAccounts={cedante.bankAccounts || []}
          bankAccount={editingBank}
          onClose={() => {
            setIsBankModalOpen(false);
            setEditingBank(null);
          }}
        />
      )}

      {/* Convention Modal */}
      {isConventionModalOpen && (
        <CedanteConventionModal
          cedanteId={id!}
          onClose={() => setIsConventionModalOpen(false)}
        />
      )}

      {/* Free Fields Modal */}
      {isFreeFieldsModalOpen && (
        <CedanteFreeFieldsModal
          cedanteId={id!}
          freeFields={cedante.freeFields}
          onClose={() => setIsFreeFieldsModalOpen(false)}
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