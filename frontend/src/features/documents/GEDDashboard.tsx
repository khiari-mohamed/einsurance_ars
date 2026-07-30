// frontend/src/features/documents/GEDDashboard.tsx
//
// ── GED — Gestion Électronique des Documents — Tableau de bord ──────────────
//
// This rewrite reconciles the dashboard with the ACTUAL backend contract
// (server/src/modules/ged/*, `Document`/`DocumentLink` Prisma models) that
// the rest of the GED module was already fixed against in prior review
// passes. Several things the previous version of this file assumed no
// longer (or never did) match reality:
//
//   • `GedService.search()` returns a paginated envelope
//     `{ data, total, page, limit }`, not a bare array — the old
//     `normalizeDocuments()` guess was actually necessary, so it's kept
//     and extended to also capture total/page for real pagination instead
//     of silently only ever showing page 1.
//   • The real `Document` row shape is `nom` / `originalName` / `mimeType` /
//     `sizeBytes` / `documentType` (free string) / `statut`
//     (`MANQUANT | EN_ATTENTE | RECU | REJETE`) / `createdAt` / `links[]`
//     — NOT `fileName` / `fileSize` / `uploadedAt` / `entityType` /
//     `status` (`DRAFT | PENDING_REVIEW | APPROVED | REJECTED`) as the
//     previous version assumed. Those field/enum names don't exist
//     anywhere in the schema or the NestJS controller/service — filtering
//     and stats rendering were silently broken.
//   • There is no `ConfidentialityLevel` anywhere in the schema — that
//     filter was dead UI wired to nothing. Removed rather than faked.
//   • `getStatistics()` really returns
//     `{ total, totalSizeBytes, byStatut, byType, recentUploads }` — the
//     `byEntity` breakdown the old cards rendered doesn't exist server-side
//     and always silently showed nothing.
//   • Uploading from this screen with a hard-coded `entityType={AFFAIRE}`
//     and `entityId=""` would be rejected by
//     `GedService.resolveEntityRef()` (`"Aucune entité cible spécifiée"`)
//     every single time — there is no such thing as an entity-less
//     document. The dashboard now requires picking a real target entity
//     before an upload can start.
//   • Delete existed end-to-end on the backend (`DELETE /ged/documents/:id`,
//     soft-delete to `REJETE`) but had no UI trigger at all. Restored,
//     behind a confirmation step.
//
// To keep this change surgical (one file, per instruction) and to avoid
// silently breaking compilation against whatever `frontend/src/types/
// ged.types.ts` currently contains, this file defines its own local,
// schema-accurate types for everything it renders directly, and only
// still imports `EntityType` from `ged.types` for the one place that
// genuinely has to interoperate with the existing, unmodified
// `DocumentUploadModal` / `BulkUploadModal` components (same contract the
// previous version of this file already used successfully).
//
// New in this pass:
//   • A Windows-Explorer-style folder tree (Entité → Type de document →
//     fichiers) in a collapsible left rail, with per-folder counts.
//   • An in-place document preview (PDF inline, images inline, everything
//     else a clean "download to open" fallback) — no dependency on the
//     as-yet-unverified `PDFViewer.tsx` prop contract.
//   • Real pagination wired to the backend's `page`/`limit`/`total`.
//   • A statistics panel that actually matches what the API returns.
//   • Restored delete (soft-delete) with a confirmation step.
//   • A guided "choisir l'entité cible" step before any upload.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import {
  Search, FileText, HardDrive, Upload, Download, Share2, AlertCircle,
  Filter, Grid, List, Folder, FolderOpen, ChevronRight, ChevronDown,
  Eye, Trash2, X, FileSpreadsheet, Image as ImageIcon, RefreshCw,
  ChevronLeft, Info, Users, Building2, Landmark, Briefcase,
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Send, ClipboardList,
  File as FileIcon, FolderTree, CalendarRange,
} from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { EntityType } from '../../types/ged.types';
import BulkUploadModal from '../../components/documents/BulkUploadModal';
import ShareLinkModal from '../../components/documents/ShareLinkModal';
import ComplianceDashboard from '../../components/documents/ComplianceDashboard';
import DocumentUploadModal from '../../components/documents/DocumentUploadModal';

// ─────────────────────────────────────────────────────────────────────────
// Local, backend-accurate types
// (Mirrors Prisma `Document` / `DocumentLink` / `DocumentEntityType` /
// `DocumentStatut` exactly — see server/src/modules/ged/ged.service.ts.)
// ─────────────────────────────────────────────────────────────────────────

type GedEntityType =
  | 'ASSURE' | 'CEDANTE' | 'REASSUREUR' | 'CO_COURTIER' | 'AFFAIRE'
  | 'SINISTRE' | 'ENCAISSEMENT' | 'DECAISSEMENT' | 'ORDRE_PAIEMENT' | 'BORDEREAU';

type GedDocumentStatut = 'MANQUANT' | 'EN_ATTENTE' | 'RECU' | 'REJETE';

interface GedDocumentLink {
  id: string;
  entityType: GedEntityType;
  assureId?: string | null;
  cedanteId?: string | null;
  reassureurId?: string | null;
  coCourtId?: string | null;
  affaireId?: string | null;
  sinistreId?: string | null;
  encaissementId?: string | null;
  decaissementId?: string | null;
  ordrePaiementId?: string | null;
  bordereauId?: string | null;
}

interface GedDocument {
  id: string;
  nom: string;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  filePath: string;
  documentType?: string | null;
  statut: GedDocumentStatut;
  isLatestVersion: boolean;
  versionNumber: number;
  uploadedById?: string | null;
  createdAt: string;
  updatedAt: string;
  links?: GedDocumentLink[];
}

interface GedStatistics {
  total: number;
  totalSizeBytes: number;
  byStatut: { statut: GedDocumentStatut; count: number }[];
  byType: { documentType: string | null; count: number }[];
  recentUploads: GedDocument[];
}

interface SearchFilters {
  documentType?: string;
  statut?: GedDocumentStatut;
  dateFrom?: string;
  dateTo?: string;
}

interface TreeSelection {
  entityType?: GedEntityType | 'SANS_ENTITE';
  documentType?: string | 'SANS_TYPE';
}

// ─────────────────────────────────────────────────────────────────────────
// Static labels / config
// ─────────────────────────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<GedEntityType, string> = {
  ASSURE: 'Assurés',
  CEDANTE: 'Cédantes',
  REASSUREUR: 'Réassureurs',
  CO_COURTIER: 'Co-Courtiers',
  AFFAIRE: 'Affaires',
  SINISTRE: 'Sinistres',
  ENCAISSEMENT: 'Encaissements',
  DECAISSEMENT: 'Décaissements',
  ORDRE_PAIEMENT: 'Ordres de Paiement',
  BORDEREAU: 'Bordereaux',
};

const ENTITY_TYPE_ICONS: Record<GedEntityType, React.ElementType> = {
  ASSURE: Users,
  CEDANTE: Building2,
  REASSUREUR: Landmark,
  CO_COURTIER: Briefcase,
  AFFAIRE: FileText,
  SINISTRE: AlertTriangle,
  ENCAISSEMENT: ArrowDownCircle,
  DECAISSEMENT: ArrowUpCircle,
  ORDRE_PAIEMENT: Send,
  BORDEREAU: ClipboardList,
};

// Free-text `documentType` values in real use across the module (CDC
// Section 10.2 checklist slots + general GED usage). Kept as plain
// strings — the backend column is `String?`, not an enum.
const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'NOTE_SYNTHESE', label: 'Note de Synthèse' },
  { value: 'SLIP_COTATION', label: 'Slip de Cotation' },
  { value: 'ORDRE_ASSURANCE', label: "Ordre d'Assurance" },
  { value: 'SLIP_COUVERTURE', label: 'Slip de Couverture' },
  { value: 'BORDEREAU_CESSION_CEDANTE', label: 'Bordereau de Cession (Cédante)' },
  { value: 'BORDEREAU_CESSION_REASSUREUR', label: 'Bordereau de Cession (Réassureur)' },
  { value: 'CONVENTION_CEDANTE', label: 'Convention Cédante' },
  { value: 'CONVENTION_REASSUREUR', label: 'Convention Réassureur' },
  { value: 'AVIS_SINISTRE', label: 'Avis de Sinistre' },
  { value: 'SWIFT', label: 'Confirmation SWIFT' },
  { value: 'POLICE', label: "Police d'Assurance" },
  { value: 'CONTRAT', label: 'Contrat' },
  { value: 'KYC', label: 'Pièce KYC' },
  { value: 'AUTRE', label: 'Autre' },
];

const DOCUMENT_TYPE_LABEL_MAP: Record<string, string> = DOCUMENT_TYPE_OPTIONS.reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<string, string>,
);

const STATUT_CONFIG: Record<GedDocumentStatut, { label: string; className: string }> = {
  MANQUANT: { label: 'Manquant', className: 'bg-gray-100 text-gray-700' },
  EN_ATTENTE: { label: 'En attente', className: 'bg-yellow-100 text-yellow-700' },
  RECU: { label: 'Reçu', className: 'bg-green-100 text-green-700' },
  REJETE: { label: 'Rejeté', className: 'bg-red-100 text-red-700' },
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

// ─────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 Ko';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' Go';
}

function formatDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function documentTypeLabel(type?: string | null): string {
  if (!type) return 'Type non défini';
  return DOCUMENT_TYPE_LABEL_MAP[type] ?? type.replace(/_/g, ' ');
}

function displayName(doc: GedDocument): string {
  return doc.originalName || doc.nom || 'Document sans nom';
}

function primaryEntityType(doc: GedDocument): GedEntityType | undefined {
  return doc.links && doc.links.length > 0 ? doc.links[0].entityType : undefined;
}

function primaryEntityId(link: GedDocumentLink): string | undefined {
  return (
    link.affaireId || link.cedanteId || link.reassureurId || link.coCourtId ||
    link.assureId || link.sinistreId || link.encaissementId || link.decaissementId ||
    link.ordrePaiementId || link.bordereauId || undefined
  );
}

/** Convenience wrapper: the (type, id) pair for whichever entity a document
 *  is actually linked to — used to surface "which record" a file belongs
 *  to, not just "which kind of record" (the entity-type badge alone can't
 *  tell two affaires apart). */
function primaryEntityRef(doc: GedDocument): { type: GedEntityType; id: string } | undefined {
  const link = doc.links && doc.links.length > 0 ? doc.links[0] : undefined;
  if (!link) return undefined;
  const id = primaryEntityId(link);
  return id ? { type: link.entityType, id } : undefined;
}

function iconForMime(mimeType?: string | null): React.ElementType {
  if (!mimeType) return FileIcon;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  return FileIcon;
}

function iconColorForMime(mimeType?: string | null): string {
  if (!mimeType) return 'text-gray-500';
  if (mimeType === 'application/pdf') return 'text-red-600';
  if (mimeType.startsWith('image/')) return 'text-purple-600';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-600';
  if (mimeType.includes('word')) return 'text-blue-600';
  return 'text-gray-500';
}

/**
 * `GedService.search()` returns `{ data, total, page, limit }`, but plenty
 * of other GED endpoints (getEntityDocuments, getAffaireDocuments…) return
 * a bare array. This normalizes either shape defensively so the dashboard
 * never crashes regardless of which one the current gedApi call actually
 * produced at runtime.
 */
function normalizeSearchResult(value: unknown): { data: GedDocument[]; total: number; page: number; limit: number } {
  if (Array.isArray(value)) {
    return { data: value as GedDocument[], total: value.length, page: 1, limit: value.length || 20 };
  }
  if (value && typeof value === 'object') {
    const v = value as any;
    if (Array.isArray(v.data)) {
      return {
        data: v.data as GedDocument[],
        total: typeof v.total === 'number' ? v.total : v.data.length,
        page: typeof v.page === 'number' ? v.page : 1,
        limit: typeof v.limit === 'number' ? v.limit : (v.data.length || 20),
      };
    }
  }
  return { data: [], total: 0, page: 1, limit: 20 };
}

// ─────────────────────────────────────────────────────────────────────────
// Tree node model
// ─────────────────────────────────────────────────────────────────────────

interface TreeTypeNode {
  key: string;              // documentType value, or 'SANS_TYPE'
  label: string;
  count: number;
  docs: GedDocument[];
}

interface TreeEntityNode {
  key: GedEntityType | 'SANS_ENTITE';
  label: string;
  count: number;
  types: TreeTypeNode[];
}

function buildTree(documents: GedDocument[]): TreeEntityNode[] {
  const byEntity = new Map<string, Map<string, GedDocument[]>>();

  for (const doc of documents) {
    const entityKey: string = primaryEntityType(doc) ?? 'SANS_ENTITE';
    const typeKey: string = doc.documentType ?? 'SANS_TYPE';

    if (!byEntity.has(entityKey)) byEntity.set(entityKey, new Map());
    const byType = byEntity.get(entityKey)!;
    if (!byType.has(typeKey)) byType.set(typeKey, []);
    byType.get(typeKey)!.push(doc);
  }

  const nodes: TreeEntityNode[] = [];
  for (const [entityKey, byType] of byEntity.entries()) {
    const types: TreeTypeNode[] = [];
    for (const [typeKey, docs] of byType.entries()) {
      types.push({
        key: typeKey,
        label: typeKey === 'SANS_TYPE' ? 'Type non défini' : documentTypeLabel(typeKey),
        count: docs.length,
        docs,
      });
    }
    types.sort((a, b) => b.count - a.count);

    const totalCount = types.reduce((sum, t) => sum + t.count, 0);
    nodes.push({
      key: entityKey as GedEntityType | 'SANS_ENTITE',
      label: entityKey === 'SANS_ENTITE' ? 'Sans entité liée' : ENTITY_TYPE_LABELS[entityKey as GedEntityType],
      count: totalCount,
      types,
    });
  }
  nodes.sort((a, b) => b.count - a.count);
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export default function GEDDashboard() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [statistics, setStatistics] = useState<GedStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [shareDoc, setShareDoc] = useState<GedDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<GedDocument | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<GedDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Windows-Explorer-style tree state
  const [showTree, setShowTree] = useState(true);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({});

  // Upload target — a document can never be attached to "nothing"; the
  // backend rejects entity-less uploads outright (resolveEntityRef()).
  const [uploadEntityType, setUploadEntityType] = useState<GedEntityType>('AFFAIRE');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [showUploadTargetPicker, setShowUploadTargetPicker] = useState<'single' | 'bulk' | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce free-text search ────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true); else setLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (searchQuery) params.search = searchQuery;
      if (filters.documentType) params.documentType = filters.documentType;
      if (filters.statut) params.statut = filters.statut;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const [docsRaw, statsRaw] = await Promise.all([
        gedApi.getDocuments(params as any),
        gedApi.getStatistics(),
      ]);

      const normalized = normalizeSearchResult((docsRaw as any).data ?? docsRaw);
      setDocuments(normalized.data);
      setTotal(normalized.total);
      const statsPayload = (statsRaw as any).data ?? statsRaw;
      setStatistics(statsPayload as unknown as GedStatistics);
      setSelectedDocs([]);
    } catch (error) {
      console.error('Échec du chargement des documents GED:', error);
      setLoadError('Impossible de charger les documents. Veuillez réessayer.');
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, searchQuery, filters]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchQuery, filters]);

  // ── Tree (built client-side from the currently loaded page) ─────────
  const tree = useMemo(() => buildTree(documents), [documents]);

  const toggleEntityExpanded = (key: string) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filteredByTree = useMemo(() => {
    if (!treeSelection.entityType && !treeSelection.documentType) return documents;
    return documents.filter(doc => {
      if (treeSelection.entityType) {
        const et = primaryEntityType(doc) ?? 'SANS_ENTITE';
        if (et !== treeSelection.entityType) return false;
      }
      if (treeSelection.documentType) {
        const dt = doc.documentType ?? 'SANS_TYPE';
        if (dt !== treeSelection.documentType) return false;
      }
      return true;
    });
  }, [documents, treeSelection]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleBulkDownload = async () => {
    if (selectedDocs.length === 0) return;
    try {
      const blob = await gedApi.bulkDownload(selectedDocs);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-${Date.now()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSelectedDocs([]);
    } catch (error) {
      console.error('Échec du téléchargement groupé:', error);
      alert('Échec du téléchargement groupé');
    }
  };

  const handleDownload = async (doc: GedDocument) => {
    try {
      const blob = await gedApi.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName(doc);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Échec du téléchargement:', error);
      alert('Échec du téléchargement');
    }
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWordHtml, setPreviewWordHtml] = useState<string | null>(null);
  const [previewExcelSheets, setPreviewExcelSheets] = useState<{ name: string; html: string }[] | null>(null);
  const [previewActiveSheet, setPreviewActiveSheet] = useState(0);
  const previewBlobRef = useRef<string | null>(null);

  const handlePreview = async (doc: GedDocument) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewWordHtml(null);
    setPreviewExcelSheets(null);
    setPreviewActiveSheet(0);
    setPreviewError(null);
    setPreviewLoading(true);

    const mime = (doc.mimeType ?? '').toLowerCase();
    const name = (doc.originalName ?? doc.nom ?? '').toLowerCase();
    const isWord = mime.includes('wordprocessingml') || mime.includes('msword') || /\.docx?$/.test(name);
    const isExcel = mime.includes('spreadsheetml') || mime.includes('excel') || /\.xlsx?$/.test(name);

    try {
      const blob = await gedApi.downloadDocument(doc.id);
      if (isWord) {
        const ab = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: ab });
        setPreviewWordHtml(result.value);
      } else if (isExcel) {
        const ab = await blob.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheets = wb.SheetNames.map((s) => ({ name: s, html: XLSX.utils.sheet_to_html(wb.Sheets[s]) }));
        setPreviewExcelSheets(sheets);
      } else {
        const typedBlob = doc.mimeType ? blob.slice(0, blob.size, doc.mimeType) : blob;
        const url = window.URL.createObjectURL(typedBlob);
        previewBlobRef.current = url;
        setPreviewUrl(url);
      }
    } catch {
      setPreviewError("Impossible de charger l'aperçu de ce document.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewBlobRef.current) { window.URL.revokeObjectURL(previewBlobRef.current); previewBlobRef.current = null; }
    setPreviewUrl(null);
    setPreviewWordHtml(null);
    setPreviewExcelSheets(null);
    setPreviewActiveSheet(0);
    setPreviewDoc(null);
    setPreviewError(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteDoc) return;
    setDeleting(true);
    try {
      await gedApi.deleteDocument(confirmDeleteDoc.id);
      setConfirmDeleteDoc(null);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Échec de la suppression:', error);
      alert('Échec de la suppression du document');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectDoc = (id: string) => {
    setSelectedDocs(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    if (selectedDocs.length === filteredByTree.length && filteredByTree.length > 0) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(filteredByTree.map(d => d.id));
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchInput('');
    setSearchQuery('');
    setTreeSelection({});
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openUploadTargetPicker = (mode: 'single' | 'bulk') => {
    setUploadEntityId('');
    setShowUploadTargetPicker(mode);
  };

  const confirmUploadTarget = () => {
    if (!uploadEntityId.trim()) return;
    if (showUploadTargetPicker === 'single') setShowUpload(true);
    if (showUploadTargetPicker === 'bulk') setShowBulkUpload(true);
    setShowUploadTargetPicker(null);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-gray-800">Gestion Électronique des Documents</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => loadData({ silent: true })}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 text-gray-700"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCompliance(!showCompliance)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Conformité
          </button>
          <button
            onClick={() => openUploadTargetPicker('single')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Télécharger
          </button>
          <button
            onClick={() => openUploadTargetPicker('bulk')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Groupé
          </button>
          {selectedDocs.length > 0 && (
            <button
              onClick={handleBulkDownload}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Télécharger ({selectedDocs.length})
            </button>
          )}
        </div>
      </div>

      {showCompliance && (
        <div className="mb-6">
          <ComplianceDashboard />
        </div>
      )}

      {/* ── Statistics ──────────────────────────────────────────────── */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-3xl font-bold text-gray-800">{statistics.total}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Espace Utilisé</p>
                <p className="text-3xl font-bold text-gray-800">{formatBytes(statistics.totalSizeBytes)}</p>
              </div>
              <HardDrive className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div>
              <p className="text-sm text-gray-600 mb-2">Par Statut</p>
              <div className="space-y-1">
                {(statistics.byStatut ?? []).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUT_CONFIG[item.statut]?.className ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUT_CONFIG[item.statut]?.label ?? item.statut}
                    </span>
                    <span className="font-semibold text-gray-700">{item.count}</span>
                  </div>
                ))}
                {(!statistics.byStatut || statistics.byStatut.length === 0) && (
                  <p className="text-xs text-gray-400">Aucune donnée</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div>
              <p className="text-sm text-gray-600 mb-2">Par Type (top 3)</p>
              <div className="space-y-1">
                {(statistics.byType ?? [])
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate pr-2">{documentTypeLabel(item.documentType)}</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                  ))}
                {(!statistics.byType || statistics.byType.length === 0) && (
                  <p className="text-xs text-gray-400">Aucune donnée</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: tree rail + main pane ─────────────────────────────── */}
      <div className="flex gap-6 items-start">
        {/* Tree rail */}
        {showTree && (
          <div className="w-72 flex-shrink-0 bg-white rounded-lg shadow p-3 sticky top-4">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <FolderTree className="w-4 h-4" />
                Arborescence
              </div>
              <button
                onClick={() => setShowTree(false)}
                className="text-gray-400 hover:text-gray-600"
                title="Masquer l'arborescence"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setTreeSelection({})}
              className={`w-full text-left px-2 py-1.5 rounded text-sm mb-1 flex items-center justify-between ${
                !treeSelection.entityType ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                {!treeSelection.entityType ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                Tous les documents
              </span>
              <span className="text-xs text-gray-400">{documents.length}</span>
            </button>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {tree.map(entityNode => {
                const EntityIcon = entityNode.key === 'SANS_ENTITE' ? Folder : ENTITY_TYPE_ICONS[entityNode.key];
                const isExpanded = expandedEntities.has(entityNode.key);
                const isSelected = treeSelection.entityType === entityNode.key && !treeSelection.documentType;

                return (
                  <div key={entityNode.key} className="mb-0.5">
                    <div
                      className={`flex items-center gap-1 px-1 py-1.5 rounded cursor-pointer text-sm ${
                        isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <button onClick={() => toggleEntityExpanded(entityNode.key)} className="p-0.5">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setTreeSelection({ entityType: entityNode.key })}
                        className="flex items-center gap-2 flex-1 truncate"
                      >
                        {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <EntityIcon className="w-4 h-4 text-gray-500" />}
                        <span className="truncate">{entityNode.label}</span>
                      </button>
                      <span className="text-xs text-gray-400 pr-1">{entityNode.count}</span>
                    </div>

                    {isExpanded && (
                      <div className="ml-6 border-l pl-2">
                        {entityNode.types.map(typeNode => {
                          const typeSelected =
                            treeSelection.entityType === entityNode.key && treeSelection.documentType === typeNode.key;
                          return (
                            <button
                              key={typeNode.key}
                              onClick={() => setTreeSelection({ entityType: entityNode.key, documentType: typeNode.key })}
                              className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded text-xs ${
                                typeSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <FileText className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{typeNode.label}</span>
                              </span>
                              <span className="text-gray-400">{typeNode.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {tree.length === 0 && (
                <p className="text-xs text-gray-400 px-2 py-4 text-center">Aucun document sur cette page</p>
              )}
            </div>
            <p className="text-[11px] text-gray-400 px-2 pt-2 mt-2 border-t">
              L'arborescence reflète les {documents.length} document(s) actuellement chargé(s) (page {page}/{totalPages}).
            </p>
          </div>
        )}

        {!showTree && (
          <button
            onClick={() => setShowTree(true)}
            className="flex-shrink-0 bg-white rounded-lg shadow p-2 h-fit sticky top-4"
            title="Afficher l'arborescence"
          >
            <FolderTree className="w-5 h-5 text-gray-500" />
          </button>
        )}

        {/* Main pane */}
        <div className="flex-1 min-w-0 bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
              <button onClick={() => setTreeSelection({})} className="hover:text-blue-600 hover:underline">
                Tous les documents
              </button>
              {treeSelection.entityType && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    onClick={() => setTreeSelection({ entityType: treeSelection.entityType })}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {treeSelection.entityType === 'SANS_ENTITE' ? 'Sans entité liée' : ENTITY_TYPE_LABELS[treeSelection.entityType as GedEntityType]}
                  </button>
                </>
              )}
              {treeSelection.documentType && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-gray-700 font-medium">
                    {treeSelection.documentType === 'SANS_TYPE' ? 'Type non défini' : documentTypeLabel(treeSelection.documentType)}
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="flex-1 relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher par nom, type de document..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 ${
                  showFilters ? 'bg-gray-50' : ''
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtres
              </button>
              <div className="flex border rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                  title="Vue liste"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                  title="Vue grille"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filters.documentType ?? ''}
                  onChange={(e) => { setFilters({ ...filters, documentType: e.target.value || undefined }); setPage(1); }}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="">Tous les types de document</option>
                  {DOCUMENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={filters.statut ?? ''}
                  onChange={(e) => { setFilters({ ...filters, statut: (e.target.value || undefined) as GedDocumentStatut | undefined }); setPage(1); }}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="">Tous les statuts</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="RECU">Reçu</option>
                  <option value="REJETE">Rejeté</option>
                  <option value="MANQUANT">Manquant</option>
                </select>

                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                  <CalendarRange className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={filters.dateFrom ?? ''}
                    onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value || undefined }); setPage(1); }}
                    className="w-full text-sm outline-none"
                    aria-label="Date de début"
                  />
                </div>

                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                  <CalendarRange className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={filters.dateTo ?? ''}
                    onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value || undefined }); setPage(1); }}
                    className="w-full text-sm outline-none"
                    aria-label="Date de fin"
                  />
                </div>

                <button
                  onClick={clearFilters}
                  className="col-span-1 md:col-span-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>

          <div className="p-6">
            {loadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {loadError}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-gray-500">Chargement...</div>
            ) : filteredByTree.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Aucun document trouvé</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDocs.length === filteredByTree.length && filteredByTree.length > 0}
                      onChange={selectAllVisible}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">
                      {selectedDocs.length > 0 ? `${selectedDocs.length} sélectionné(s)` : 'Tout sélectionner'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {filteredByTree.length} document(s) affiché(s) · {total} au total
                  </span>
                </div>

                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
                  {filteredByTree.map((doc) => {
                    const Icon = iconForMime(doc.mimeType);
                    const iconColor = iconColorForMime(doc.mimeType);
                    const entityRef = primaryEntityRef(doc);
                    return (
                      <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedDocs.includes(doc.id)}
                              onChange={() => toggleSelectDoc(doc.id)}
                              className="w-4 h-4 flex-shrink-0"
                            />
                            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate" title={displayName(doc)}>{displayName(doc)}</h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {documentTypeLabel(doc.documentType)}
                                </span>
                                {entityRef && (
                                  <span
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                                    title={`${ENTITY_TYPE_LABELS[entityRef.type]} — ${entityRef.id}`}
                                  >
                                    {ENTITY_TYPE_LABELS[entityRef.type]} · {entityRef.id.slice(0, 8)}
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-1 rounded ${STATUT_CONFIG[doc.statut]?.className ?? 'bg-gray-100 text-gray-700'}`}>
                                  {STATUT_CONFIG[doc.statut]?.label ?? doc.statut}
                                </span>
                                {doc.versionNumber > 1 && (
                                  <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded">
                                    v{doc.versionNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {formatDate(doc.createdAt)} • {formatBytes(doc.sizeBytes)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => doc.sizeBytes && doc.sizeBytes > 0 && doc.statut !== 'MANQUANT' ? handlePreview(doc) : undefined}
                              disabled={!doc.sizeBytes || doc.sizeBytes === 0 || doc.statut === 'MANQUANT'}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title={!doc.sizeBytes || doc.sizeBytes === 0 ? 'Aucun fichier disponible' : 'Aperçu'}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => doc.sizeBytes && doc.sizeBytes > 0 ? handleDownload(doc) : undefined}
                              disabled={!doc.sizeBytes || doc.sizeBytes === 0 || doc.statut === 'MANQUANT'}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title={!doc.sizeBytes || doc.sizeBytes === 0 ? 'Aucun fichier disponible' : 'Télécharger'}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShareDoc(doc)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded"
                              title="Partager"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteDoc(doc)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Éléments par page :</span>
                    <select
                      value={limit}
                      onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                      className="border rounded px-2 py-1"
                    >
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload target picker ────────────────────────────────────── */}
      {showUploadTargetPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Choisir l'entité cible</h2>
              <button onClick={() => setShowUploadTargetPicker(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Chaque document doit être rattaché à une entité existante (une affaire, un sinistre, une cédante...).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'entité</label>
                <select
                  value={uploadEntityType}
                  onChange={(e) => setUploadEntityType(e.target.value as GedEntityType)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {(Object.keys(ENTITY_TYPE_LABELS) as GedEntityType[]).map(key => (
                    <option key={key} value={key}>{ENTITY_TYPE_LABELS[key]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant de l'entité</label>
                <input
                  type="text"
                  value={uploadEntityId}
                  onChange={(e) => setUploadEntityId(e.target.value)}
                  placeholder="Ex. numéro d'affaire, code cédante..."
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowUploadTargetPicker(null)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmUploadTarget}
                disabled={!uploadEntityId.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentUploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        entityType={uploadEntityType as unknown as EntityType}
        entityId={uploadEntityId}
        onSuccess={() => loadData({ silent: true })}
      />

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        entityType={uploadEntityType as unknown as EntityType}
        entityId={uploadEntityId}
        onSuccess={() => loadData({ silent: true })}
      />

      {shareDoc && (
        <ShareLinkModal
          isOpen={true}
          onClose={() => setShareDoc(null)}
          documentId={shareDoc.id}
          documentName={displayName(shareDoc)}
        />
      )}

      {/* ── Preview modal ───────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const Icon = iconForMime(previewDoc.mimeType);
                  return <Icon className={`w-5 h-5 flex-shrink-0 ${iconColorForMime(previewDoc.mimeType)}`} />;
                })()}
                <h2 className="font-semibold text-gray-800 truncate">{displayName(previewDoc)}</h2>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={closePreview} className="p-2 text-gray-400 hover:bg-gray-100 rounded" title="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto">
              {previewLoading && <p className="text-gray-500">Chargement de l'aperçu...</p>}
              {!previewLoading && previewError && (
                <div className="text-center text-gray-500 p-6">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
                  <p>{previewError}</p>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && previewDoc?.mimeType === 'application/pdf' && (
                <iframe src={previewUrl} title={displayName(previewDoc)} className="w-full h-full border-0" />
              )}
              {!previewLoading && !previewError && previewUrl && previewDoc?.mimeType?.startsWith('image/') && (
                <img src={previewUrl} alt={displayName(previewDoc)} className="max-w-full max-h-full object-contain" />
              )}
              {!previewLoading && !previewError && previewWordHtml && (
                <div className="w-full h-full overflow-auto bg-white p-8">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewWordHtml }} />
                </div>
              )}
              {!previewLoading && !previewError && previewExcelSheets && (
                <div className="w-full h-full flex flex-col overflow-hidden">
                  {previewExcelSheets.length > 1 && (
                    <div className="flex gap-1 px-4 pt-2 bg-white border-b shrink-0 overflow-x-auto">
                      {previewExcelSheets.map((s, i) => (
                        <button
                          key={s.name}
                          onClick={() => setPreviewActiveSheet(i)}
                          className={`px-3 py-1.5 text-[12px] font-medium rounded-t-lg whitespace-nowrap ${
                            previewActiveSheet === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className="flex-1 overflow-auto bg-white p-4 text-[12px] [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:font-medium"
                    dangerouslySetInnerHTML={{ __html: previewExcelSheets[previewActiveSheet]?.html ?? '' }}
                  />
                </div>
              )}
              {!previewLoading && !previewError && previewUrl &&
                previewDoc?.mimeType !== 'application/pdf' && !previewDoc?.mimeType?.startsWith('image/') && (
                <div className="text-center text-gray-500 p-6">
                  <FileIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="mb-3">L'aperçu en ligne n'est pas disponible pour ce type de fichier.</p>
                  <button
                    onClick={() => handleDownload(previewDoc!)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger pour ouvrir
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-2 border-t text-xs text-gray-500 flex items-center gap-3 flex-wrap">
              <span>{documentTypeLabel(previewDoc.documentType)}</span>
              <span>•</span>
              <span>{formatBytes(previewDoc.sizeBytes)}</span>
              <span>•</span>
              <span>Ajouté le {formatDate(previewDoc.createdAt)}</span>
              {previewDoc.versionNumber > 1 && (
                <>
                  <span>•</span>
                  <span>Version {previewDoc.versionNumber}</span>
                </>
              )}
              {(() => {
                const ref = primaryEntityRef(previewDoc);
                if (!ref) return null;
                return (
                  <>
                    <span>•</span>
                    <span>Lié à : {ENTITY_TYPE_LABELS[ref.type]} ({ref.id})</span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────────────── */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="font-semibold text-gray-800">Supprimer ce document ?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              « {displayName(confirmDeleteDoc)} » sera marqué comme rejeté et retiré de toutes les listes. Cette action est irréversible depuis cet écran.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={deleting}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}