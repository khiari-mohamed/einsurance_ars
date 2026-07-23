import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Trash2, Plus, Shield, Globe, FileText, Phone, Landmark,
  Settings2, ShieldCheck, AlertCircle, Upload, X, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { coCourtiersApi, conventionsApi } from '../../api/master-data.api';
import {
  CoCourtier,
  CoCourtierContact,
  CoCourtierBankAccount,
  getCoCourtierIdentifiantUniqueError,
} from '../../types/co-courtier.types';
import type { ConventionPartnerType } from '../../types/convention.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import CoCourtierContactModal, { ContactFormData } from './CoCourtierContactModal';
import CoCourtierBankAccountModal, { BankAccountFormData } from './CoCourtierBankAccountModal';
import CoCourtierConventionModal from './CoCourtierConventionModal';
import CoCourtierFreeFieldsModal from './CoCourtierFreeFieldsModal';

type TabKey = 'info' | 'contacts' | 'conventions' | 'bank' | 'free';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'info', label: 'Informations Générales', icon: Shield },
  { key: 'contacts', label: 'Contacts', icon: Phone },
  { key: 'conventions', label: 'Conventions / Affaires', icon: FileText },
  { key: 'bank', label: 'Coordonnées Bancaires', icon: Landmark },
  { key: 'free', label: 'Champs Libres', icon: Settings2 },
];

const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'JPY'];

// Strip a full backend entity down to the create-DTO shape the nested
// deleteMany+create write on the backend actually accepts.
function toContactDto(c: Partial<CoCourtierContact>): ContactFormData {
  return {
    nom: c.nom || '',
    prenom: c.prenom,
    poste: c.poste,
    telephoneFixe: c.telephoneFixe,
    telephoneMobile: c.telephoneMobile,
    email: c.email,
  };
}

function toBankAccountDto(a: Partial<CoCourtierBankAccount>): BankAccountFormData {
  return {
    banque: a.banque || '',
    agence: a.agence,
    rib: a.rib || '',
    iban: a.iban,
    swift: a.swift,
    currency: a.currency || 'TND',
    isDefault: a.isDefault,
  };
}

export default function CoCourtierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const [contactModal, setContactModal] = useState<{ open: boolean; contact: CoCourtierContact | null }>({ open: false, contact: null });
  const [bankModal, setBankModal] = useState<{ open: boolean; account: CoCourtierBankAccount | null }>({ open: false, account: null });
  const [conventionModalOpen, setConventionModalOpen] = useState(false);
  const [freeFieldsModalOpen, setFreeFieldsModalOpen] = useState(false);
  const [overrideCodeOpen, setOverrideCodeOpen] = useState(false);
  const [overrideCodeValue, setOverrideCodeValue] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; onConfirm?: () => void }>({ open: false, message: '' });

  const { data: coCourtier, isLoading, error } = useQuery({
    queryKey: ['co-courtier', id],
    queryFn: async () => {
      const { data } = await coCourtiersApi.getOne(id!);
      return data as CoCourtier;
    },
    enabled: !!id,
  });

  const { data: conventions } = useQuery({
    queryKey: ['co-courtier-conventions', id],
    queryFn: async () => {
      const partnerType: ConventionPartnerType = 'CO_COURTIER';
      const { data } = await conventionsApi.listForPartner(partnerType, id!);
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => coCourtiersApi.update(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtier', id] });
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
    },
  });

  // Reactivation has no dedicated single-record endpoint — reuse bulkUpdate
  // with a single id, same as the backend already supports for bulk edit.
  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => coCourtiersApi.bulkUpdate([id!], { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtier', id] });
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => coCourtiersApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtier', id] });
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
    },
  });

  const overrideCodeMutation = useMutation({
    mutationFn: (code: string) => coCourtiersApi.overrideCode(id!, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtier', id] });
      setOverrideCodeOpen(false);
      setOverrideCodeValue('');
      setOverrideError('');
    },
    onError: (err: any) => {
      setOverrideError(err.response?.data?.message || 'Erreur lors de la modification du code.');
    },
  });

  const conventionDeactivateMutation = useMutation({
    mutationFn: (conventionId: string) => conventionsApi.deactivate(conventionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtier-conventions', id] });
    },
  });

  // ---- Contacts: full-array replace (backend does deleteMany + create) ----
  const saveContact = (formData: ContactFormData) => {
    if (!coCourtier) return;
    const existing = coCourtier.contacts || [];
    const next = contactModal.contact
      ? existing.map((c) => (c.id === contactModal.contact!.id ? formData : toContactDto(c)))
      : [...existing.map(toContactDto), formData];

    updateMutation.mutate(
      { contacts: next },
      { onSuccess: () => setContactModal({ open: false, contact: null }) },
    );
  };

  const deleteContact = (contactId: string) => {
    if (!coCourtier) return;
    setConfirmState({
      open: true,
      message: 'Supprimer ce contact ?',
      onConfirm: () => {
        const next = (coCourtier.contacts || []).filter((c) => c.id !== contactId).map(toContactDto);
        updateMutation.mutate({ contacts: next });
        setConfirmState({ open: false, message: '' });
      },
    });
  };

  // ---- Bank accounts: same pattern ----
  const saveBankAccount = (formData: BankAccountFormData) => {
    if (!coCourtier) return;
    const existing = coCourtier.bankAccounts || [];
    const next = bankModal.account
      ? existing.map((a) => (a.id === bankModal.account!.id ? formData : toBankAccountDto(a)))
      : [...existing.map(toBankAccountDto), formData];

    updateMutation.mutate(
      { bankAccounts: next },
      { onSuccess: () => setBankModal({ open: false, account: null }) },
    );
  };

  const deleteBankAccount = (accountId: string) => {
    if (!coCourtier) return;
    setConfirmState({
      open: true,
      message: 'Supprimer ce compte bancaire ?',
      onConfirm: () => {
        const next = (coCourtier.bankAccounts || []).filter((a) => a.id !== accountId).map(toBankAccountDto);
        updateMutation.mutate({ bankAccounts: next });
        setConfirmState({ open: false, message: '' });
      },
    });
  };

  const saveFreeFields = (freeFields: Record<string, any>) => {
    updateMutation.mutate({ freeFields }, { onSuccess: () => setFreeFieldsModalOpen(false) });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Chargement...</div>;
  }

  if (error || !coCourtier) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
        <p className="text-[13px] text-red-600">Courtier introuvable.</p>
        <button onClick={() => navigate('/co-courtiers')} className="mt-3 text-[13px] text-blue-600 hover:text-blue-700 font-medium">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <ConfirmDialog
        open={confirmState.open}
        title="Confirmation"
        message={confirmState.message}
        confirmLabel="Confirmer"
        confirmVariant="danger"
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ open: false, message: '' })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/co-courtiers')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold text-gray-900">{coCourtier.raisonSociale}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                coCourtier.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
              }`}>
                {coCourtier.isActive === false ? 'Inactif' : 'Actif'}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-1 font-mono">{coCourtier.code} · {coCourtier.compteComptable}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {coCourtier.isActive === false ? (
            <button
              onClick={() => statusMutation.mutate(true)}
              disabled={statusMutation.isPending}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-[13px] font-medium disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Réactiver
            </button>
          ) : (
            <button
              onClick={() =>
                setConfirmState({
                  open: true,
                  message: "Désactiver ce courtier ? Il restera visible dans l'historique mais ne sera plus sélectionnable pour de nouvelles affaires.",
                  onConfirm: () => {
                    deactivateMutation.mutate();
                    setConfirmState({ open: false, message: '' });
                  },
                })
              }
              className="flex items-center gap-2 bg-white border border-red-200 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-[13px] font-medium"
            >
              <Trash2 size={16} />
              Désactiver
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
        {activeTab === 'info' && (
          <InfoTab
            coCourtier={coCourtier}
            onUpdate={(data) => updateMutation.mutate(data)}
            isSaving={updateMutation.isPending}
            onOverrideCode={() => setOverrideCodeOpen(true)}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={coCourtier.contacts || []}
            onAdd={() => setContactModal({ open: true, contact: null })}
            onEdit={(c) => setContactModal({ open: true, contact: c })}
            onDelete={deleteContact}
          />
        )}

        {activeTab === 'conventions' && (
          <ConventionsTab
            conventions={conventions || []}
            documents={coCourtier.documents || []}
            onAttach={() => setConventionModalOpen(true)}
            onDeactivate={(cid) => conventionDeactivateMutation.mutate(cid)}
          />
        )}

        {activeTab === 'bank' && (
          <BankAccountsTab
            accounts={coCourtier.bankAccounts || []}
            resident={coCourtier.resident}
            onAdd={() => setBankModal({ open: true, account: null })}
            onEdit={(a) => setBankModal({ open: true, account: a })}
            onDelete={deleteBankAccount}
          />
        )}

        {activeTab === 'free' && (
          <FreeFieldsTab freeFields={coCourtier.freeFields || {}} onEdit={() => setFreeFieldsModalOpen(true)} />
        )}
      </div>

      {contactModal.open && (
        <CoCourtierContactModal
          contact={contactModal.contact}
          onSave={saveContact}
          onClose={() => setContactModal({ open: false, contact: null })}
          isSaving={updateMutation.isPending}
        />
      )}

      {bankModal.open && (
        <CoCourtierBankAccountModal
          account={bankModal.account}
          courtierResident={coCourtier.resident}
          onSave={saveBankAccount}
          onClose={() => setBankModal({ open: false, account: null })}
          isSaving={updateMutation.isPending}
        />
      )}

      {conventionModalOpen && (
        <CoCourtierConventionModal
          coCourtierId={coCourtier.id}
          onClose={() => setConventionModalOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['co-courtier-conventions', id] });
            setConventionModalOpen(false);
          }}
        />
      )}

      {freeFieldsModalOpen && (
        <CoCourtierFreeFieldsModal
          freeFields={coCourtier.freeFields || {}}
          onSave={saveFreeFields}
          onClose={() => setFreeFieldsModalOpen(false)}
          isSaving={updateMutation.isPending}
        />
      )}

      {overrideCodeOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">Modifier le code (Admin)</h2>
              <button onClick={() => setOverrideCodeOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {overrideError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
                  {overrideError}
                </div>
              )}
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nouveau code</label>
              <input
                type="text"
                value={overrideCodeValue}
                onChange={(e) => setOverrideCodeValue(e.target.value.toUpperCase())}
                placeholder="CCO-0099"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-[11px] text-gray-400">Format : CCO-XXXX. Code actuel : {coCourtier.code}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => setOverrideCodeOpen(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Annuler
              </button>
              <button
                onClick={() => overrideCodeMutation.mutate(overrideCodeValue)}
                disabled={overrideCodeMutation.isPending || !overrideCodeValue}
                className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {overrideCodeMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: Informations Générales
// ============================================================

function InfoTab({
  coCourtier,
  onUpdate,
  isSaving,
  onOverrideCode,
}: {
  coCourtier: CoCourtier;
  onUpdate: (data: Partial<CoCourtier>) => void;
  isSaving: boolean;
  onOverrideCode: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CoCourtier>>(coCourtier);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const startEdit = () => {
    setForm(coCourtier);
    setErrors({});
    setEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      const nextValue = name === 'identifiantUnique' ? value.toUpperCase() : value;
      setForm((prev) => ({ ...prev, [name]: nextValue }));
    }
  };

  const handleSave = () => {
    const identifiantError = getCoCourtierIdentifiantUniqueError(form.identifiantUnique, form.resident);
    if (identifiantError) {
      setErrors({ identifiantUnique: identifiantError });
      return;
    }
    onUpdate({
      raisonSociale: form.raisonSociale,
      rne: form.rne,
      identifiantUnique: form.identifiantUnique,
      resident: form.resident,
      formeJuridique: form.formeJuridique,
      adresse: form.adresse,
      pays: form.pays,
      capital: form.capital,
      deviseParDefaut: form.deviseParDefaut,
    });
    setEditing(false);
  };

  const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div>
      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">{label}</p>
      <p className="text-[14px] text-gray-900">{value ?? <span className="text-gray-400">—</span>}</p>
    </div>
  );

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold text-gray-900">Informations Générales</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onOverrideCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Réservé aux administrateurs"
            >
              <ShieldCheck size={14} />
              Modifier le code
            </button>
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 size={14} />
              Modifier
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field label="Code" value={<span className="font-mono">{coCourtier.code}</span>} />
          <Field label="Compte Comptable" value={<span className="font-mono">{coCourtier.compteComptable}</span>} />
          <Field label="Raison Sociale" value={coCourtier.raisonSociale} />
          <Field label="RNE" value={coCourtier.rne} />
          <Field label="Identifiant Unique" value={<span className="font-mono">{coCourtier.identifiantUnique}</span>} />
          <Field
            label="Résident"
            value={
              coCourtier.resident ? (
                <span className="flex items-center gap-1 text-green-700"><Shield size={14} />Oui (Tunisien)</span>
              ) : (
                <span className="flex items-center gap-1 text-blue-600"><Globe size={14} />Non (Étranger)</span>
              )
            }
          />
          <Field label="Forme Juridique" value={coCourtier.formeJuridique} />
          <Field label="Adresse" value={coCourtier.adresse} />
          <Field label="Pays" value={coCourtier.pays} />
          <Field
            label="Capital"
            value={coCourtier.capital != null ? `${coCourtier.capital.toLocaleString('fr-TN')} ${coCourtier.deviseParDefaut || 'TND'}` : undefined}
          />
          <Field label="Devise par défaut" value={coCourtier.deviseParDefaut || 'TND'} />
        </div>

        {coCourtier.oldCode && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">
              Code précédent : <span className="font-mono">{coCourtier.oldCode}</span>
              {coCourtier.codeModifiedAt && ` — modifié le ${new Date(coCourtier.codeModifiedAt).toLocaleDateString('fr-FR')}`}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-gray-900 mb-5">Modifier les informations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Raison Sociale</label>
          <input name="raisonSociale" value={form.raisonSociale || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Forme Juridique</label>
          <input name="formeJuridique" value={form.formeJuridique || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Résident Tunisien</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="checkbox" name="resident" checked={form.resident === true} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <span className="text-[13px] text-gray-700">Oui</span>
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Identifiant Unique {form.resident && <span className="text-red-500">*</span>}
          </label>
          <input
            name="identifiantUnique"
            value={form.identifiantUnique || ''}
            onChange={handleChange}
            placeholder="1234567A"
            className={`w-full px-3 py-2 border ${errors.identifiantUnique ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
          {errors.identifiantUnique && <p className="mt-1 text-[11px] text-red-500">{errors.identifiantUnique}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">RNE</label>
          <input name="rne" value={form.rne || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Adresse</label>
          <input name="adresse" value={form.adresse || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pays</label>
          <input name="pays" value={form.pays || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Capital</label>
          <input type="number" name="capital" value={form.capital ?? ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Devise par défaut</label>
          <select name="deviseParDefaut" value={form.deviseParDefaut || 'TND'} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
        <button onClick={() => setEditing(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          Annuler
        </button>
        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAB: Contacts
// ============================================================

function ContactsTab({
  contacts,
  onAdd,
  onEdit,
  onDelete,
}: {
  contacts: CoCourtierContact[];
  onAdd: () => void;
  onEdit: (c: CoCourtierContact) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900">Contacts</h3>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={14} />
          Ajouter un contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-[13px] text-gray-500 text-center py-8">Aucun contact enregistré.</p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Nom</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Poste</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Téléphone fixe</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Mobile</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-[13px] text-gray-900">{c.prenom ? `${c.prenom} ${c.nom}` : c.nom}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{c.poste || '-'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{c.telephoneFixe || '-'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{c.telephoneMobile || '-'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{c.email || '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: Conventions / Affaires (GED)
// ============================================================

function ConventionsTab({
  conventions,
  documents,
  onAttach,
  onDeactivate,
}: {
  conventions: any[];
  documents: any[];
  onAttach: () => void;
  onDeactivate: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-semibold text-gray-900">Conventions de co-courtage (GED)</h3>
        <button onClick={onAttach} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Upload size={14} />
          Joindre une convention
        </button>
      </div>
      <p className="text-[12px] text-gray-500 mb-5">
        Historique des conventions signées (GED). La liste dynamique des affaires liées à ce courtier
        n'est pas encore disponible — le module Affaires n'a pas de relation directe avec les
        co-courtiers côté backend (contrairement au Réassureur).
      </p>

      {conventions.length === 0 ? (
        <p className="text-[13px] text-gray-500 text-center py-8 border border-dashed border-gray-200 rounded-lg">
          Aucune convention enregistrée.
        </p>
      ) : (
        <div className="space-y-3 mb-8">
          {conventions.map((conv: any) => (
            <div key={conv.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <div>
                  <p className="text-[13px] font-medium text-gray-900">
                    {conv.document?.originalName || conv.document?.nom || 'Convention'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {conv.dateSignature && `Signée le ${new Date(conv.dateSignature).toLocaleDateString('fr-FR')}`}
                    {conv.dateEffet && ` · Effet le ${new Date(conv.dateEffet).toLocaleDateString('fr-FR')}`}
                    {!conv.isActive && ' · Archivée'}
                  </p>
                  {conv.notes && <p className="text-[11px] text-gray-400 mt-0.5">{conv.notes}</p>}
                </div>
              </div>
              {conv.isActive && (
                <button onClick={() => onDeactivate(conv.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors" title="Archiver">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h4 className="text-[13px] font-semibold text-gray-900 mb-3">Autres documents</h4>
      {documents.length === 0 ? (
        <p className="text-[13px] text-gray-500">Aucun autre document lié à cette fiche.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg">
              <FileText size={16} className="text-gray-400" />
              <p className="text-[13px] text-gray-700">{d.document?.originalName || d.document?.nom}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: Coordonnées Bancaires
// ============================================================

function BankAccountsTab({
  accounts,
  resident,
  onAdd,
  onEdit,
  onDelete,
}: {
  accounts: CoCourtierBankAccount[];
  resident?: boolean;
  onAdd: () => void;
  onEdit: (a: CoCourtierBankAccount) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">Coordonnées Bancaires</h3>
          {resident === false && (
            <p className="text-[12px] text-amber-600 mt-1">
              Entité non-résidente : le code SWIFT/BIC est requis pour chaque compte.
            </p>
          )}
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={14} />
          Ajouter un compte
        </button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-[13px] text-gray-500 text-center py-8">Aucun compte bancaire enregistré.</p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Banque</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Agence</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">RIB</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">IBAN</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">SWIFT</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Devise</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Défaut</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-[13px] text-gray-900">{a.banque}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{a.agence || '-'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600 font-mono">{a.rib}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600 font-mono">{a.iban || '-'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600 font-mono">
                    {a.swift || (resident === false ? <span className="text-amber-600">Manquant</span> : '-')}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{a.currency}</td>
                  <td className="px-4 py-2.5 text-[13px]">{a.isDefault && <CheckCircle2 size={14} className="text-green-600" />}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onEdit(a)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: Champs Libres
// ============================================================

function FreeFieldsTab({ freeFields, onEdit }: { freeFields: Record<string, any>; onEdit: () => void }) {
  const entries = Object.entries(freeFields || {});
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900">Champs Libres</h3>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Edit2 size={14} />
          Gérer les champs
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px] text-gray-500 text-center py-8">Aucun champ libre configuré.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map(([key, value]) => (
            <div key={key}>
              <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">{key}</p>
              <p className="text-[14px] text-gray-900">{String(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}