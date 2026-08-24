import { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Mail,
  Phone,
  Building2,
  CreditCard,
  FileText,
  FileCheck,
  Shield,
  Globe,
  Folder,
  Sliders,
  Eye,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  File as FileIcon,
} from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { reassureursApi, conventionsApi } from '../../api/master-data.api';
import {
  Reassureur,
  ReassureurContact,
  ReassureurBankAccount,
  AffaireReassureur,
  getSwiftWarning,
} from '../../types/reassureur.types';
import { Convention } from '../../types/convention.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import ReassureurContactModal from './ReassureurContactModal';
import ReassureurBankAccountModal from './ReassureurBankAccountModal';
import ReassureurConventionModal from './ReassureurConventionModal';
import ReassureurFreeFieldsModal from './ReassureurFreeFieldsModal';

type ConfirmType = 'deactivate' | 'delete-contact' | 'delete-bank' | 'deactivate-convention' | 'override-code' | null;

export default function ReassureurDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ReassureurContact | null>(null);

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<ReassureurBankAccount | null>(null);

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [isConventionModalOpen, setIsConventionModalOpen] = useState(false);
  const [isFreeFieldsModalOpen, setIsFreeFieldsModalOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ id: string; name: string; mimeType?: string } | null>(null);

  // FIX: this state was referenced everywhere (handleDeactivate, handleDeleteContact,
  // handleOverrideCode, the <ConfirmDialog> at the bottom) but never declared —
  // root cause of every "Cannot find name 'confirmState'/'setConfirmState'" error.
  const [confirmState, setConfirmState] = useState<{
    type: ConfirmType;
    onConfirm?: () => void;
    message?: string;
  }>({ type: null });

  const { data: reassureur, isLoading } = useQuery<Reassureur>({
    queryKey: ['reassureurs', id],
    queryFn: async () => {
      const { data } = await reassureursApi.getOne(id!);
      return data;
    },
    enabled: !!id,
  });

  const { data: conventions = [] } = useQuery<Convention[]>({
    queryKey: ['reassureurs', id, 'conventions'],
    queryFn: async () => {
      const { data } = await conventionsApi.listForPartner('REASSUREUR', id!);
      return data;
    },
    enabled: !!id,
  });

  // FIX: getParticipations() was removed from reassureursApi — it was redundant.
  // ReassureursService.findOne() already returns `participations` (with nested
  // affaire.cedante / affaire.facultativeData.assure) directly on the main
  // GET /reassureurs/:id response. No separate query needed.
  const contracts = reassureur?.participations ?? [];

  const deleteMutation = useMutation({
    mutationFn: () => reassureursApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs'] });
      navigate('/reassureurs');
    },
  });

  // FIX: deleteContact() doesn't exist on the API (no per-contact route on the
  // backend). The only way to remove a contact is the same full-array-replace
  // pattern used everywhere else: rebuild the contacts array without the deleted
  // one and PUT the whole thing via reassureursApi.update().
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => {
      const remaining = (reassureur?.contacts ?? [])
        .filter((c) => c.id !== contactId)
        .map((c) => ({
          nom: c.nom,
          prenom: c.prenom,
          poste: c.poste,
          telephoneFixe: c.telephoneFixe,
          telephoneMobile: c.telephoneMobile,
          email: c.email,
        }));
      return reassureursApi.update(id!, { contacts: remaining });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', id] });
    },
  });

  // NEW: bank account deletion — same full-array-replace pattern, mirroring
  // ReassureurBankAccountModal's own save logic. There was previously no way to
  // remove a bank account at all from this page.
  const deleteBankAccountMutation = useMutation({
    mutationFn: (bankId: string) => {
      const remaining = (reassureur?.bankAccounts ?? [])
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
      return reassureursApi.update(id!, { bankAccounts: remaining });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', id] });
    },
  });

  const deactivateConventionMutation = useMutation({
    mutationFn: (conventionId: string) => conventionsApi.deactivate(conventionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', id, 'conventions'] });
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

  const handleDeactivate = () => {
    setConfirmState({
      type: 'deactivate',
      message: 'Désactiver ce réassureur ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.',
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
      type: 'delete-bank',
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
      message: 'Désactiver cette convention ? Elle ne sera plus affichée dans la liste active mais restera conservée.',
      onConfirm: () => {
        deactivateConventionMutation.mutate(conventionId);
        setConfirmState({ type: null });
      },
    });
  };

  const handleOverrideCode = () => {
    if (!newCode.match(/^REA-[0-9]{4}$/)) {
      alert('Le code doit être au format REA-XXXX (ex: REA-0042)');
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
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!reassureur) {
    return (
      <div className="p-6 text-center text-muted-foreground">
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
            className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">{reassureur.raisonSociale}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[13px] text-muted-foreground">Code: {reassureur.code}</p>
              {reassureur.oldCode && (
                <p className="text-[11px] text-muted-foreground/70">Ancien code: {reassureur.oldCode}</p>
              )}
              {reassureur.codeModifiedAt && (
                <p className="text-[11px] text-muted-foreground/70">
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
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-warning hover:bg-warning/10 rounded-xl transition-colors"
            >
              <Edit2 size={16} />
              Modifier le code
            </button>
          )}
          {reassureur.isActive !== false && (
            <button
              onClick={handleDeactivate}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
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
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-muted-foreground" />
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
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-[12px] font-medium text-muted-foreground mb-2">Champs libres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(reassureur.freeFields).map(([key, value]) => (
                    <InfoField key={key} label={key} value={String(value)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Phone size={18} className="text-muted-foreground" />
                Contacts
              </h2>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setIsContactModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {reassureur.contacts && reassureur.contacts.length > 0 ? (
              <div className="space-y-3">
                {reassureur.contacts.map((contact: ReassureurContact) => (
                  <div key={contact.id} className="p-3 border border-border/50 rounded-xl hover:bg-secondary/40 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {/* FIX: `contact.isDefault` badge removed — the shared Contact
                            Prisma model has no isDefault field (unlike BankAccount).
                            The type was corrected to match; this render must match too. */}
                        <p className="text-[13px] font-medium text-foreground">
                          {contact.prenom} {contact.nom}
                        </p>
                        {contact.poste && (
                          <p className="text-[11px] text-muted-foreground">{contact.poste}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingContact(contact);
                            setIsContactModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-primary/10 text-primary"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {contact.email && (
                      <p className="text-[12px] text-muted-foreground flex items-center gap-1 mb-1">
                        <Mail size={12} />
                        {contact.email}
                      </p>
                    )}
                    {contact.telephoneFixe && (
                      <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                        <Phone size={12} />
                        {contact.telephoneFixe} <span className="text-muted-foreground/70">(fixe)</span>
                      </p>
                    )}
                    {contact.telephoneMobile && (
                      <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                        <Phone size={12} />
                        {contact.telephoneMobile} <span className="text-muted-foreground/70">(mobile)</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-4">Aucun contact</p>
            )}
          </div>

          {/* Bank Accounts */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <CreditCard size={18} className="text-muted-foreground" />
                Coordonnées bancaires
              </h2>
              {/* FIX (missing feature): there was no way to add/edit/delete a bank
                  account from this page at all, even though
                  ReassureurBankAccountModal.tsx already existed and was fully wired
                  for it — it just wasn't imported/used here. */}
              <button
                onClick={() => {
                  setEditingBankAccount(null);
                  setIsBankModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {reassureur.bankAccounts && reassureur.bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {reassureur.bankAccounts.map((bank: ReassureurBankAccount) => {
                  const swiftWarning = getSwiftWarning(bank.swift, reassureur.resident);
                  return (
                    <div key={bank.id} className="p-3 border border-border/50 rounded-xl hover:bg-secondary/40 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-foreground">
                            {bank.banque}
                            {bank.isDefault && (
                              <span className="ml-2 inline-block rounded-full bg-success/15 text-success border border-success/25 text-[10px] px-2 py-0.5">
                                Principal
                              </span>
                            )}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                            <p className="text-[12px] text-muted-foreground">RIB: {bank.rib}</p>
                            <p className="text-[12px] text-muted-foreground">Devise: {bank.currency}</p>
                            {bank.swift && (
                              <p className="text-[12px] text-muted-foreground">SWIFT: {bank.swift}</p>
                            )}
                            {bank.iban && (
                              <p className="text-[12px] text-muted-foreground">IBAN: {bank.iban}</p>
                            )}
                          </div>
                          {/* NEW: surfaces the same non-blocking data-quality flag the
                              backend already logs (MISSING_SWIFT_NON_RESIDENT) — was
                              previously invisible to the user, per the old TODO comment. */}
                          {swiftWarning && (
                            <p className="mt-1.5 text-[11px] text-warning">{swiftWarning}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingBankAccount(bank);
                              setIsBankModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-primary/10 text-primary"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBankAccount(bank.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-4">Aucun compte bancaire</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-muted-foreground" />
                Conventions
              </h2>
              <button
                onClick={() => setIsConventionModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {conventions.length > 0 ? (
              <div className="space-y-3">
                {conventions.map((convention) => (
                  <div key={convention.id} className="p-3 border border-border/50 rounded-xl hover:bg-secondary/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{convention.document.originalName || convention.document.nom || 'Convention'}</p>
                        <div className="mt-1 text-[11px] text-muted-foreground grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <span>Date signature: {convention.dateSignature ? new Date(convention.dateSignature).toLocaleDateString('fr-FR') : '-'}</span>
                          <span>Date d'effet: {convention.dateEffet ? new Date(convention.dateEffet).toLocaleDateString('fr-FR') : '-'}</span>
                          <span>Ajouté le {new Date(convention.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                        {convention.notes && (
                          <p className="text-[12px] text-muted-foreground mt-2 whitespace-pre-wrap">{convention.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeactivateConvention(convention.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0 ml-2"
                        title="Désactiver cette convention"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-4">Aucune convention</p>
            )}
          </div>

          <GedDocumentsSection
            documents={reassureur.documents ?? []}
            onView={(doc) => setViewerDoc(doc)}
          />

          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Sliders size={18} className="text-muted-foreground" />
                Champs libres
              </h2>
              <button
                onClick={() => setIsFreeFieldsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                <Edit2 size={14} />
                Modifier
              </button>
            </div>
            {reassureur.freeFields && Object.keys(reassureur.freeFields).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(reassureur.freeFields).map(([key, value]) => (
                  <InfoField key={key} label={key} value={String(value)} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-4">Aucun champ libre défini</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <h2 className="font-display text-base font-semibold text-foreground mb-4">Statut</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Actif</span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium border ${reassureur.isActive ? 'bg-success/15 text-success border-success/25' : 'bg-destructive/15 text-destructive border-destructive/25'}`}>
                  {reassureur.isActive ? 'Oui' : 'Non'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Compte verrouillé</span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium border ${reassureur.isAccountLocked ? 'bg-muted text-muted-foreground border-border' : 'bg-warning/15 text-warning border-warning/25'}`}>
                  {reassureur.isAccountLocked ? 'Verrouillé' : 'Déverrouillé'}
                </span>
              </div>
              {reassureur.codeModifiedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Code modifié par</span>
                  <span className="text-[13px] text-foreground">{reassureur.codeModifiedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Participations (Contrats) */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileCheck size={18} className="text-muted-foreground" />
              Participations
            </h2>
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {/* FIX: was reading non-existent fields (numéroPolice, numeroAffaire,
                    reference, category) — the real Affaire model exposes `numero` and
                    `type` (FACULTATIVE/TRAITE), and the tiers name comes from either
                    affaire.cedante (treaty) or affaire.facultativeData.assure (fac). */}
                {contracts.map((participation: AffaireReassureur) => {
                  const affaire = participation.affaire;
                  const tiersLabel =
                    affaire?.cedante?.raisonSociale ??
                    affaire?.facultativeData?.assure?.raisonSociale ??
                    'N/A';
                  return (
                    <div
                      key={participation.id}
                      onClick={() => affaire?.id && navigate(`/affaires/${affaire.id}`)}
                      className="p-3 border border-border/50 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer"
                    >
                      <p className="text-[13px] font-medium text-foreground">
                        {affaire?.numero || 'Affaire'}
                        {participation.isLeader && (
                          <span className="ml-2 inline-block rounded-full bg-warning/15 text-warning border border-warning/25 text-[10px] px-2 py-0.5">
                            Leader
                          </span>
                        )}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-muted-foreground">
                          {tiersLabel} · {affaire?.type === 'TRAITE' ? 'Traité' : 'Facultative'}
                        </p>
                        <span className="text-[11px] font-semibold text-primary">
                          {participation.partPct != null ? `${participation.partPct}%` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-4">Aucune participation</p>
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
            : confirmState.type === 'delete-bank'
            ? 'Suppression du compte bancaire'
            : confirmState.type === 'deactivate-convention'
            ? 'Désactivation de la convention'
            : 'Confirmation'
        }
        message={confirmState.message || ''}
        confirmLabel="Confirmer"
        confirmVariant="danger"
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ type: null })}
      />

      {/* Contact Modal — FIX: now imports the real, correct ReassureurContactModal
          (which does the full-array-replace via reassureursApi.update()) instead of
          a broken local duplicate that called non-existent addContact/updateContact
          endpoints and required an isDefault field the type doesn't have. */}
      {isContactModalOpen && (
        <ReassureurContactModal
          reassureurId={id!}
          existingContacts={reassureur.contacts ?? []}
          contact={editingContact}
          onClose={() => {
            setIsContactModalOpen(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Bank Account Modal — NEW: wasn't wired up at all before. */}
      {isBankModalOpen && (
        <ReassureurBankAccountModal
          reassureurId={id!}
          resident={reassureur.resident}
          existingBankAccounts={reassureur.bankAccounts ?? []}
          bankAccount={editingBankAccount}
          onClose={() => {
            setIsBankModalOpen(false);
            setEditingBankAccount(null);
          }}
        />
      )}

      {isConventionModalOpen && (
        <ReassureurConventionModal
          reassureurId={id!}
          onClose={() => setIsConventionModalOpen(false)}
        />
      )}

      {isFreeFieldsModalOpen && (
        <ReassureurFreeFieldsModal
          reassureurId={id!}
          freeFields={reassureur.freeFields}
          onClose={() => setIsFreeFieldsModalOpen(false)}
        />
      )}

      {viewerDoc && (
        <GedDocumentViewer
          docId={viewerDoc.id}
          docName={viewerDoc.name}
          mimeType={viewerDoc.mimeType}
          onClose={() => setViewerDoc(null)}
        />
      )}

      {/* Override Code Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-border bg-card shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-border">
              <h2 className="font-display text-lg font-semibold text-foreground">Modifier le code</h2>
              <p className="text-[13px] text-muted-foreground mt-1">Format: REA-XXXX (ex: REA-0042)</p>
            </div>
            <div className="p-6">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Nouveau code</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="REA-0001"
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-warning mt-2">
                ⚠️ Cette action est irréversible et sera enregistrée dans l'historique d'audit.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => {
                  setIsOverrideModalOpen(false);
                  setNewCode('');
                }}
                className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleOverrideCode}
                disabled={overrideCodeMutation.isPending}
                className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
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
      <p className="text-[11px] text-muted-foreground uppercase font-medium mb-1">{label}</p>
      <p className="text-[13px] text-foreground flex items-center gap-1.5">
        {icon}
        {value || '-'}
      </p>
    </div>
  );
}const GED_PAGE_SIZE = 5;

interface GedDocumentsSectionProps {
  documents: Array<{
    id: string;
    document?: {
      id: string;
      nom: string;
      originalName?: string | null;
      mimeType?: string | null;
      documentType?: string | null;
    };
    createdAt: string;
  }>;
  onView: (doc: { id: string; name: string; mimeType?: string }) => void;
}

function GedDocumentsSection({ documents, onView }: GedDocumentsSectionProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(documents.length / GED_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = documents.slice((safePage - 1) * GED_PAGE_SIZE, safePage * GED_PAGE_SIZE);

  const handleDownload = async (docId: string, name: string) => {
    try {
      const blob = await gedApi.downloadDocument(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors du t l chargement');
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
      <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <Folder size={18} className="text-muted-foreground" />
        Documents (GED)
      </h2>
      {documents.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-4">Aucun document</p>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((link) => {
              const doc = link.document;
              const name = doc?.originalName || doc?.nom || 'document';
              const docId = doc?.id;
              return (
                <div key={link.id} className="flex items-center justify-between p-3 border border-border/50 rounded-xl hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon size={14} className="text-muted-foreground/70 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground truncate">{name}</p>
                      {doc?.documentType && (
                        <p className="text-[10px] text-muted-foreground/70 uppercase">{doc.documentType}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-[11px] text-muted-foreground/70 mr-2">
                      {new Date(link.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    {docId && (
                      <>
                        <button
                          onClick={() => onView({ id: docId, name, mimeType: doc?.mimeType ?? undefined })}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary"
                          title="Voir"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDownload(docId, name)}
                          className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground"
                          title="T l charger"
                        >
                          <Download size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <p className="text-[11px] text-muted-foreground/70">Page {safePage} / {totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="p-1 rounded-lg border border-border hover:bg-secondary/40 disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  className="p-1 rounded-lg border border-border hover:bg-secondary/40 disabled:opacity-40"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface GedDocumentViewerProps {
  docId: string;
  docName: string;
  mimeType?: string;
  onClose: () => void;
}

function GedDocumentViewer({ docId, docName, mimeType, onClose }: GedDocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<{ name: string; html: string }[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const blobRef = useRef<string | null>(null);

  const mime = mimeType?.toLowerCase() ?? '';
  const lowerName = docName.toLowerCase();
  const isPdf = mime.includes('pdf') || lowerName.endsWith('.pdf');
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName);
  const isWord = mime.includes('wordprocessingml') || mime.includes('msword') || /\.docx?$/i.test(lowerName);
  const isExcel = mime.includes('spreadsheetml') || mime.includes('excel') || /\.xlsx?$/i.test(lowerName);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setWordHtml(null);
    setExcelSheets(null);
    setActiveSheet(0);

    gedApi.downloadDocument(docId)
      .then(async (blob) => {
        if (cancelled) return;

        if (isWord) {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) setWordHtml(result.value);
        } else if (isExcel) {
          const arrayBuffer = await blob.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const sheets = wb.SheetNames.map((sheetName) => ({
            name: sheetName,
            html: XLSX.utils.sheet_to_html(wb.Sheets[sheetName]),
          }));
          if (!cancelled) setExcelSheets(sheets);
        } else {
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          if (!cancelled) setBlobUrl(url);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [docId, isExcel, isImage, isPdf, isWord]);

  const handleDownload = async () => {
    try {
      const blob = await gedApi.downloadDocument(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-border bg-card shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <p className="text-[14px] font-semibold text-foreground truncate">{docName}</p>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-xl transition-colors"
            >
              <Download size={14} />
              T l charger
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-secondary/60 text-muted-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        {excelSheets && excelSheets.length > 1 && (
          <div className="flex gap-1 px-4 pt-2 border-b border-border shrink-0 overflow-x-auto">
            {excelSheets.map((sheet, index) => (
              <button
                key={sheet.name}
                onClick={() => setActiveSheet(index)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  activeSheet === index ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-secondary/30 flex items-center justify-center p-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-[13px]">Chargement...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3">
              <FileIcon size={48} className="text-muted-foreground/40" />
              <p className="text-[13px] text-destructive">Impossible de charger le document.</p>
              <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl">
                <Download size={14} /> T l charger   la place
              </button>
            </div>
          )}
          {!loading && !error && (
            <>
              {isPdf && blobUrl && (
                <iframe src={blobUrl} title={docName} className="w-full h-full rounded-xl border border-border bg-card" />
              )}
              {isImage && blobUrl && (
                <img src={blobUrl} alt={docName} className="max-w-full max-h-full object-contain rounded-xl" />
              )}
              {isWord && wordHtml && (
                <div className="w-full h-full overflow-auto bg-card rounded-xl border border-border p-8">
                  <div
                    className="prose prose-sm max-w-none prose-invert:dark"
                    dangerouslySetInnerHTML={{ __html: wordHtml }}
                  />
                </div>
              )}
              {isExcel && excelSheets && (
                <div className="w-full h-full overflow-auto bg-card rounded-xl border border-border">
                  <div
                    className="p-4 text-[12px] text-foreground [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-secondary [&_th]:font-medium"
                    dangerouslySetInnerHTML={{ __html: excelSheets[activeSheet]?.html ?? '' }}
                  />
                </div>
              )}
              {!isPdf && !isImage && !isWord && !isExcel && (
                <div className="flex flex-col items-center gap-3">
                  <FileIcon size={48} className="text-muted-foreground/40" />
                  <p className="text-[13px] text-muted-foreground">Aper u non disponible pour ce type de fichier.</p>
                  <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl">
                    <Download size={14} /> T l charger le fichier
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}