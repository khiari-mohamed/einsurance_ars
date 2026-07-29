// FIX (SWIFT/GED gap): full rewrite. Previous version described a
// fictional model — DocumentEntityType had no ORDRE_PAIEMENT at all (so a
// SWIFT confirmation could never even be typed correctly), Document had
// fields (fileName/storagePath/confidentialityLevel/status as an enum)
// that don't exist on the real Prisma model, and UploadDocumentDto used a
// generic entityId instead of matching the backend's per-entity-type FK
// shape (assureId/cedanteId/.../ordrePaiementId).

export enum DocumentEntityType {
  ASSURE = 'ASSURE',
  CEDANTE = 'CEDANTE',
  REASSUREUR = 'REASSUREUR',
  CO_COURTIER = 'CO_COURTIER',
  AFFAIRE = 'AFFAIRE',
  SINISTRE = 'SINISTRE',
  ENCAISSEMENT = 'ENCAISSEMENT',
  DECAISSEMENT = 'DECAISSEMENT',
  ORDRE_PAIEMENT = 'ORDRE_PAIEMENT',
  BORDEREAU = 'BORDEREAU',
}

// Alias kept for backward compatibility — uploads.api.ts imports `EntityType`.
export { DocumentEntityType as EntityType };

export enum DocumentStatut {
  MANQUANT = 'MANQUANT',
  EN_ATTENTE = 'EN_ATTENTE',
  RECU = 'RECU',
  REJETE = 'REJETE',
}

// documentType is a free-form business string on the backend, not a fixed
// enum — this is a curated list for populating <select> options only. Any
// string is accepted server-side.
export const KNOWN_DOCUMENT_TYPES = [
  'SLIP_COTATION', 'CONVENTION', 'SWIFT', 'SWIFT_CONFIRMATION', 'CONTRAT',
  'NOTE_SYNTHESE', 'POLICE', 'BORDEREAU_MODELE', 'PAYMENT_JUSTIFICATION',
  'BANK_STATEMENT', 'AVIS_SINISTRE', 'EXPERT_REPORT', 'OTHER',
] as const;

export enum DocumentType {
  OTHER = 'OTHER',
  NOTE_SYNTHESE = 'NOTE_SYNTHESE',
  SLIP_COTATION = 'SLIP_COTATION',
  SLIP_COUVERTURE = 'SLIP_COUVERTURE',
  BORDEREAU_CESSION = 'BORDEREAU_CESSION',
  AVIS_SINISTRE = 'AVIS_SINISTRE',
  PAYMENT_ORDER = 'PAYMENT_ORDER',
  SWIFT_CONFIRMATION = 'SWIFT_CONFIRMATION',
  CORRESPONDENCE = 'CORRESPONDENCE',
}

export enum ConfidentialityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SECRET = 'SECRET',
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  filePath: string;
  uploadedById?: string;
  comment?: string;
  createdAt: string;
}

export interface DocumentLink {
  id: string;
  documentId: string;
  document?: Document;
  entityType: DocumentEntityType;
  assureId?: string;
  cedanteId?: string;
  reassureurId?: string;
  coCourtId?: string;
  affaireId?: string;
  sinistreId?: string;
  encaissementId?: string;
  decaissementId?: string;
  ordrePaiementId?: string;
  bordereauId?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  nom: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  filePath: string;
  ocrText?: string;
  documentType?: string;
  statut: DocumentStatut;
  isLatestVersion: boolean;
  versionNumber: number;
  uploadedById?: string;
  links?: DocumentLink[];
  versions?: DocumentVersion[];
  createdAt: string;
  updatedAt: string;
}

// Matches server UploadDocumentDto exactly — one FK per possible target,
// not a generic entityId. entityType is optional and, if supplied, is
// cross-checked server-side against whichever FK is actually set.
export interface UploadDocumentDto {
  documentType?: string;
  entityType?: DocumentEntityType;
  assureId?: string;
  cedanteId?: string;
  reassureurId?: string;
  coCourtId?: string;
  affaireId?: string;
  sinistreId?: string;
  encaissementId?: string;
  decaissementId?: string;
  ordrePaiementId?: string;
  bordereauId?: string;
  comment?: string;
}

export interface UpdateDocumentDto {
  documentType?: string;
  nom?: string;
  statut?: DocumentStatut;
}

export interface SearchDocumentDto {
  search?: string;
  documentType?: string;
  entityType?: DocumentEntityType;
  entityId?: string;
  affaireId?: string;
  statut?: DocumentStatut;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedDocuments {
  data: Document[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentStatistics {
  total: number;
  totalSizeBytes: number;
  byStatut: { statut: DocumentStatut; count: number }[];
  byType: { documentType: string | null; count: number }[];
  recentUploads: Document[];
}

export interface DocumentChecklistItem {
  id: string;
  checklistId: string;
  documentType: string;
  libelle: string;
  isMandatory: boolean;
  statut: DocumentStatut;
  documentId?: string;
  receivedAt?: string;
  ordre: number;
}

export interface DocumentChecklist {
  id: string;
  affaireId: string;
  items: DocumentChecklistItem[];
  completionPct: number;
  updatedAt: string;
  createdAt: string;
}

export interface ShareLinkConfig {
  userId?: string;
  email?: string;
  expiresAt?: string;
  // NOTE: password/maxDownloads are accepted by the backend's ShareDocumentDto
  // but NOT yet persisted or enforced (see GedService.share()'s own
  // SCHEMA TODO comment) — included here for forward-compat, but don't rely
  // on them actually protecting the link today.
  password?: string;
  maxDownloads?: number;
}

export interface ShareLinkResult {
  token: string;
  url: string;
  expiresAt?: string;
}