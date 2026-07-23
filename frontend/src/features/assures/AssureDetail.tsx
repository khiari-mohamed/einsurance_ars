// src/pages/assures/AssureDetail.tsx (same path as your existing file)
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, FileText, FileCheck,
  Search, Filter, X, Download, FileSpreadsheet, Eye, ChevronLeft, ChevronRight,
  File as FileIcon, Image as ImageIcon, BarChart3, Users,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import * as XLSX from 'xlsx';
import { assuresApi } from '../../api/master-data.api';
import { affairesApi } from '../../api/affaires.api';
import { useAuthStore } from '../../lib/store';
import { Assure, AssureContact } from '../../types/assure.types';
import { EntityType } from '../../types/ged.types';
import ContactModal from './ContactModal';
import DocumentUploadModal from '../../components/documents/DocumentUploadModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

// ------------------------------------------------------------------
// Local types
// NOTE: `documents` is still accessed via `(assure as any)?.documents` below —
// Assure type doesn't declare a `documents` field even though this UI clearly
// depends on it. Worth adding `documents?: AssureDocumentItem[]` to Assure in
// assure.types.ts properly rather than casting — flagging rather than changing
// that file again outside its own review pass.
// ------------------------------------------------------------------
interface AssureDocumentItem {
  id: string;
  nom: string;
  originalName?: string | null;
  mimeType?: string | null;
  filePath: string;
  documentType?: string | null;
  statut?: string;
  createdAt: string;
}

type ContractTypeFilter = 'ALL' | 'FACULTATIVE' | 'TRAITE';
type ReassuranceFilter = 'ALL' | 'PROPORTIONNEL' | 'NON_PROPORTIONNEL';
type DocKind = 'pdf' | 'image' | 'office' | 'other';

const ITEMS_PER_PAGE = 6;
const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626'];

function getFileKind(doc: AssureDocumentItem): DocKind {
  const mime = (doc.mimeType || '').toLowerCase();
  const name = (doc.originalName || doc.nom || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : '';

  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('excel') ||
    mime.includes('powerpoint')
  ) {
    return 'office';
  }
  return 'other';
}


export default function AssureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const canOverrideCode = user?.role === 'SUPER_ADMIN';

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<AssureContact | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ContractTypeFilter>('ALL');
  const [reassuranceFilter, setReassuranceFilter] = useState<ReassuranceFilter>('ALL');
  const [cedanteFilter, setCedanteFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewerDocument, setViewerDocument] = useState<AssureDocumentItem | null>(null);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{ type: 'deactivate' | 'delete-contact' | 'override-code' | null; message?: string; onConfirm?: () => void }>({ type: null });

  const { data: assure, isLoading } = useQuery<Assure>({
    queryKey: ['assures', id],
    queryFn: async () => {
      const { data } = await assuresApi.getOne(id!);
      return data;
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['assures', id, 'contracts'],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({ assureId: id, limit: 100 });
      return data.data || data;
    },
    enabled: !!id,
  });

  const documents: AssureDocumentItem[] = useMemo(() => {
    const rawDocuments = (assure as any)?.documents ?? [];

    return rawDocuments.map((entry: any) => {
      const document = entry?.document ?? entry;
      return {
        id: document?.id ?? entry?.id,
        nom: document?.nom ?? entry?.nom,
        originalName: document?.originalName ?? entry?.originalName,
        mimeType: document?.mimeType ?? entry?.mimeType,
        filePath: document?.filePath ?? entry?.filePath,
        documentType: document?.documentType ?? entry?.documentType,
        statut: document?.statut ?? entry?.statut,
        createdAt: document?.createdAt ?? entry?.createdAt ?? new Date().toISOString(),
      } satisfies AssureDocumentItem;
    });
  }, [assure]);

  const normalizeCategoryLabel = (value: string | undefined) => {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower === 'facultative') return 'Facultative';
    if (lower === 'traitee' || lower === 'traite') return 'Traité';
    return value[0]?.toUpperCase() + value.slice(1).toLowerCase();
  };

  const normalizeTypeLabel = (value: string | undefined) => {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower === 'proportionnel') return 'Proportionnel';
    if (lower === 'non_proportionnel' || lower === 'non proportionnel') return 'Non proportionnel';
    return value[0]?.toUpperCase() + value.slice(1).toLowerCase();
  };

  const formatContractTitle = (contract: any) => {
    return (
      contract.numero ||
      contract.numeroPolice ||
      contract.numeroAffaire ||
      contract.numeroPoliceCedante ||
      contract.reference ||
      contract.branche ||
      contract.cedante?.raisonSociale ||
      contract.id ||
      'Contrat'
    );
  };

  const formatContractSubtitle = (contract: any) => {
    const parts: string[] = [];
    const categoryLabel = normalizeCategoryLabel(contract.category);
    if (categoryLabel) parts.push(categoryLabel);

    const typeLabel = normalizeTypeLabel(contract.type);
    if (typeLabel && typeLabel !== categoryLabel) parts.push(typeLabel);

    if (contract.cedante?.raisonSociale) {
      parts.push(contract.cedante.raisonSociale);
    }

    if (parts.length === 0) {
      return contract.id ? `ID: ${contract.id}` : 'Contrat sans référence';
    }

    return parts.join(' • ');
  };

  const deleteMutation = useMutation({
    mutationFn: () => assuresApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
      navigate('/assures');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => assuresApi.deleteContact(id!, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures', id] });
    },
  });

  const overrideCodeMutation = useMutation({
    mutationFn: (code: string) => assuresApi.overrideCode(id!, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures', id] });
      setIsOverrideModalOpen(false);
      setNewCode('');
    },
  });

  // FIX: relabeled "Supprimer" -> "Désactiver", same rationale as Cedante/Reassureur.
  const handleDeactivate = () => {
    setConfirmState({
      type: 'deactivate',
      message: 'Désactiver ce client ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.',
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
    if (!newCode.match(/^CLI-[0-9]{4}$/)) {
      alert('Le code doit être au format CLI-XXXX (ex: CLI-0042)');
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

  const cedanteOptions = useMemo(() => {
    const names = new Set<string>();
    contracts.forEach((c: any) => {
      if (c.cedante?.raisonSociale) names.add(c.cedante.raisonSociale);
    });
    return Array.from(names).sort();
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return contracts.filter((contract: any) => {
      if (term) {
        const haystack = [
          formatContractTitle(contract),
          formatContractSubtitle(contract),
          contract.numeroPoliceCedante,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (typeFilter !== 'ALL') {
        const rawCategory = (contract.category || '').toLowerCase();
        const isFacultative = rawCategory === 'facultative';
        const isTraite = rawCategory === 'traitee' || rawCategory === 'traite';
        if (typeFilter === 'FACULTATIVE' && !isFacultative) return false;
        if (typeFilter === 'TRAITE' && !isTraite) return false;
      }

      if (reassuranceFilter !== 'ALL') {
        const rawType = (contract.type || '').toLowerCase();
        const isProp = rawType === 'proportionnel';
        const isNonProp = rawType === 'non_proportionnel' || rawType === 'non proportionnel';
        if (reassuranceFilter === 'PROPORTIONNEL' && !isProp) return false;
        if (reassuranceFilter === 'NON_PROPORTIONNEL' && !isNonProp) return false;
      }

      if (cedanteFilter !== 'ALL' && contract.cedante?.raisonSociale !== cedanteFilter) {
        return false;
      }

      if (dateFrom && contract.dateEffet) {
        if (new Date(contract.dateEffet) < new Date(dateFrom)) return false;
      }
      if (dateTo && contract.dateEffet) {
        if (new Date(contract.dateEffet) > new Date(dateTo)) return false;
      }

      return true;
    });
  }, [contracts, searchTerm, typeFilter, reassuranceFilter, cedanteFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, reassuranceFilter, cedanteFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContracts = filteredContracts.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const activeFilterCount = [
    typeFilter !== 'ALL',
    reassuranceFilter !== 'ALL',
    cedanteFilter !== 'ALL',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setTypeFilter('ALL');
    setReassuranceFilter('ALL');
    setCedanteFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const categoryChartData = useMemo(() => {
    let facultative = 0;
    let traite = 0;
    let autre = 0;
    contracts.forEach((c: any) => {
      const raw = (c.category || '').toLowerCase();
      if (raw === 'facultative') facultative++;
      else if (raw === 'traitee' || raw === 'traite') traite++;
      else autre++;
    });
    return [
      { name: 'Facultative', value: facultative },
      { name: 'Traité', value: traite },
      ...(autre > 0 ? [{ name: 'Autre', value: autre }] : []),
    ].filter((d) => d.value > 0);
  }, [contracts]);

  const yearChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach((c: any) => {
      const year = c.dateEffet ? new Date(c.dateEffet).getFullYear().toString() : 'N/A';
      counts[year] = (counts[year] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ year, contrats: count }));
  }, [contracts]);

  const handleExportExcel = () => {
    if (!assure) return;

    const rows = filteredContracts.map((c: any) => ({
      Référence: formatContractTitle(c),
      Catégorie: normalizeCategoryLabel(c.category),
      Type: normalizeTypeLabel(c.type),
      Cédante: c.cedante?.raisonSociale || '-',
      'Police cédante': c.numeroPoliceCedante || '-',
      'Date effet': c.dateEffet ? new Date(c.dateEffet).toLocaleDateString('fr-FR') : '-',
      'Date échéance': c.dateEcheance ? new Date(c.dateEcheance).toLocaleDateString('fr-FR') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Référence: 'Aucun contrat' }]);
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contrats');

    const fileName = `Contrats_${assure.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!assure) {
    return <div className="p-6 text-center text-gray-500">Client non trouvé</div>;
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/assures')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-[15px] shadow-sm">
              {assure.raisonSociale?.slice(0, 2).toUpperCase() || 'AS'}
            </div>
            <div>
              <h1 className="text-[24px] font-semibold text-gray-900">{assure.raisonSociale}</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[13px] text-gray-500">Code: {assure.code}</p>
                {assure.oldCode && (
                  <p className="text-[11px] text-gray-400">Ancien code: {assure.oldCode}</p>
                )}
                {assure.codeModifiedAt && (
                  <p className="text-[11px] text-gray-400">
                    Modifié le {new Date(assure.codeModifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canOverrideCode && (
            <button
              onClick={() => setIsOverrideModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Edit2 size={16} />
              Modifier le code
            </button>
          )}
          {assure.isActive !== false && (
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

      {/* Overview: stat cards + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<FileCheck size={18} className="text-blue-600" />}
          label="Total contrats"
          value={contracts.length}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<BarChart3 size={18} className="text-purple-600" />}
          label="Facultatives"
          value={categoryChartData.find((d) => d.name === 'Facultative')?.value ?? 0}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<BarChart3 size={18} className="text-emerald-600" />}
          label="Traités"
          value={categoryChartData.find((d) => d.name === 'Traité')?.value ?? 0}
          bg="bg-emerald-50"
        />
        <StatCard
          icon={<Users size={18} className="text-amber-600" />}
          label="Contacts"
          value={assure.contacts?.length ?? 0}
          bg="bg-amber-50"
        />
      </div>

      {contracts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChartIcon size={16} />
              Répartition par catégorie
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {categoryChartData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={16} />
              Contrats par année d'effet
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="contrats" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations générales */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Raison Sociale" value={assure.raisonSociale} />
              <InfoField label="Code" value={assure.code} />
              <InfoField label="Forme Juridique" value={assure.formeJuridique} />
              <InfoField label="RNE (legacy)" value={assure.rne || '-'} />
              <InfoField label="Pays" value={assure.pays || '-'} />
              <InfoField label="Adresse" value={assure.adresse || '-'} className="md:col-span-2" />
              <InfoField label="Capital" value={assure.capital ? `${assure.capital} TND` : '-'} />
            </div>
            {assure.freeFields && Object.keys(assure.freeFields).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-[12px] font-medium text-gray-500 mb-2">Champs libres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(assure.freeFields).map(([key, value]) => (
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
            {assure.contacts && assure.contacts.length > 0 ? (
              <div className="space-y-3">
                {assure.contacts.map((contact: AssureContact) => (
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

          {assure.freeFields?.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Notes
              </h2>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{assure.freeFields.notes}</p>
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
                <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${assure.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {assure.isActive ? 'Oui' : 'Non'}
                </span>
              </div>
              {assure.codeModifiedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">Code modifié par</span>
                  <span className="text-[13px] text-gray-900">{assure.codeModifiedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} />
                Documents
              </h2>
              <button
                onClick={() => setIsDocumentUploadOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const kind = getFileKind(doc);
                  const Icon = kind === 'image' ? ImageIcon : kind === 'pdf' ? FileText : FileIcon;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={16} className="text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-gray-900 truncate">
                            {doc.originalName || doc.nom}
                          </p>
                          {doc.documentType && (
                            <p className="text-[10px] text-gray-500">{doc.documentType}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setViewerDocument(doc)}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                          title="Aperçu"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={doc.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="Télécharger"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun document</p>
            )}
          </div>
        </div>
      </div>

      {/* Contrats — full width: search, filters, table, pagination, export */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck size={18} />
            Contrats
            <span className="text-[12px] font-normal text-gray-400">
              ({filteredContracts.length}/{contracts.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Filter size={14} />
              Filtres
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-semibold bg-blue-600 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filteredContracts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={14} />
              Export Excel
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un contrat (référence, cédante, police...)"
            className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 mb-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Catégorie</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ContractTypeFilter)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Toutes</option>
                <option value="FACULTATIVE">Facultative</option>
                <option value="TRAITE">Traité</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Réassurance</label>
              <select
                value={reassuranceFilter}
                onChange={(e) => setReassuranceFilter(e.target.value as ReassuranceFilter)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Toutes</option>
                <option value="PROPORTIONNEL">Proportionnel</option>
                <option value="NON_PROPORTIONNEL">Non proportionnel</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Cédante</label>
              <select
                value={cedanteFilter}
                onChange={(e) => setCedanteFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Toutes</option>
                {cedanteOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Date effet — de</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Date effet — à</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="md:col-span-5 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-red-600"
                >
                  <X size={12} />
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {paginatedContracts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-[11px] font-medium text-gray-500 uppercase">Référence</th>
                  <th className="pb-2 text-[11px] font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="pb-2 text-[11px] font-medium text-gray-500 uppercase">Cédante</th>
                  <th className="pb-2 text-[11px] font-medium text-gray-500 uppercase">Police cédante</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContracts.map((contract: any) => (
                  <tr
                    key={contract.id}
                    onClick={() => navigate(`/affaires/${contract.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 text-[13px] font-medium text-gray-900">
                      {formatContractTitle(contract)}
                    </td>
                    <td className="py-2.5 text-[12px] text-gray-600">{formatContractSubtitle(contract)}</td>
                    <td className="py-2.5 text-[12px] text-gray-600">
                      {contract.cedante?.raisonSociale || '-'}
                    </td>
                    <td className="py-2.5 text-[12px] text-gray-600">
                      {contract.numeroPoliceCedante || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-gray-500 text-center py-8">Aucun contrat ne correspond à cette recherche</p>
        )}

        {/* Pagination */}
        {filteredContracts.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-[12px] text-gray-500">
              Page {safePage} / {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {isContactModalOpen && (
        <ContactModal
          assureId={id!}
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
              <p className="text-[13px] text-gray-500 mt-1">Format: CLI-XXXX (ex: CLI-0042)</p>
            </div>
            <div className="p-6">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nouveau code</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="CLI-0001"
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

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        entityType={EntityType.CLIENT}
        entityId={id!}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['assures', id] });
          setIsDocumentUploadOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmState.type !== null}
        title={confirmState.type === 'deactivate' ? 'Désactivation' : confirmState.type === 'delete-contact' ? 'Suppression' : 'Confirmation'}
        message={confirmState.message || ''}
        confirmLabel="Confirmer"
        confirmVariant="danger"
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ type: null })}
      />

      {/* Document viewer popup */}
      {viewerDocument && (
        <DocumentViewerModal document={viewerDocument} onClose={() => setViewerDocument(null)} />
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

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}

function StatCard({ icon, label, value, bg }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <p className="text-[20px] font-semibold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

interface DocumentViewerModalProps {
  document: AssureDocumentItem | null;
  onClose: () => void;
}

function DocumentViewerModal({ document: doc, onClose }: DocumentViewerModalProps) {
  if (!doc) return null;

  const kind = getFileKind(doc);
  const displayName = doc.originalName || doc.nom;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {doc.documentType && (
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {doc.documentType}
                </span>
              )}
              {doc.statut && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  {doc.statut}
                </span>
              )}
              <span className="text-[10px] text-gray-400">
                {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={doc.filePath}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download size={14} />
              Télécharger
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
          {kind === 'pdf' && (
            <iframe src={doc.filePath} title={displayName} className="w-full h-full rounded-lg border border-gray-200 bg-white" />
          )}

          {kind === 'image' && (
            <img src={doc.filePath} alt={displayName} className="max-w-full max-h-full object-contain rounded-lg" />
          )}

          {kind === 'office' && (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.filePath)}`}
                title={displayName}
                className="w-full h-full rounded-lg border border-gray-200 bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                L'aperçu Office nécessite que le fichier soit accessible via une URL publique en HTTPS.
                Si l'aperçu ne s'affiche pas, utilisez le téléchargement.
              </p>
            </div>
          )}

          {kind === 'other' && (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FileIcon size={48} />
              <p className="text-[13px] text-gray-500">Aperçu non disponible pour ce type de fichier</p>
              <a
                href={doc.filePath}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download size={14} />
                Télécharger le fichier
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}