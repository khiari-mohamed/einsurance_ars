export enum EntityType {
  CLIENT = 'client',
  CEDANTE = 'cedante',
  REASSUREUR = 'reassureur',
  CO_COURTIER = 'co_courtier',
  AFFAIRE = 'affaire',
  SINISTRE = 'sinistre',
  FINANCE = 'finance',
  ACCOUNTING = 'accounting',
}

export enum DocumentType {
  ID_CARD = 'id_card',
  COMPANY_REGISTRATION = 'company_registration',
  INSURANCE_POLICY = 'insurance_policy',
  CORRESPONDENCE = 'correspondence',
  LEGAL_DOCUMENT = 'legal_document',
  BANKING_INFO = 'banking_info',
  POWER_OF_ATTORNEY = 'power_of_attorney',
  TREATY_AGREEMENT = 'treaty_agreement',
  NOTE_SYNTHESE = 'note_synthese',
  DEMANDE_COTATION = 'demande_cotation',
  SLIP_COTATION = 'slip_cotation',
  ORDRE_PLACEMENT = 'ordre_placement',
  SLIP_COUVERTURE = 'slip_couverture',
  BORDEREAU_CESSION = 'bordereau_cession',
  BORDEREAU_REASSUREUR = 'bordereau_reassureur',
  BORDEREAU_SINISTRE = 'bordereau_sinistre',
  AVIS_SINISTRE = 'avis_sinistre',
  EXPERT_REPORT = 'expert_report',
  CLAIM_ASSESSMENT = 'claim_assessment',
  PAYMENT_JUSTIFICATION = 'payment_justification',
  PAYMENT_ORDER = 'payment_order',
  SWIFT_CONFIRMATION = 'swift_confirmation',
  BANK_STATEMENT = 'bank_statement',
  COMMISSION_CALCULATION = 'commission_calculation',
  SETTLEMENT_STATEMENT = 'settlement_statement',
  ACCOUNTING_ENTRY = 'accounting_entry',
  AUDIT_DOCUMENT = 'audit_document',
  CADRE_CONTRACTUEL = 'cadre_contractuel',
  PLACEMENT_PLAN = 'placement_plan',
  TECHNICAL_QUESTIONNAIRE = 'technical_questionnaire',
  REINSURER_RESPONSE = 'reinsurer_response',
  COMMISSION_AGREEMENT = 'commission_agreement',
  SAP_DOCUMENT = 'sap_document',
  PMD_DOCUMENT = 'pmd_document',
  SITUATION_STATEMENT = 'situation_statement',
  OTHER = 'other',
}

export enum ConfidentialityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export interface Document {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  entityType: EntityType;
  entityId: string;
  documentType: DocumentType;
  confidentialityLevel: ConfidentialityLevel;
  status: DocumentStatus;
  validFrom?: string;
  validTo?: string;
  tags: string[];
  description?: string;
  version: number;
  checksum: string;
  ocrText?: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  uploadedById: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface UploadDocumentDto {
  entityType: EntityType;
  entityId: string;
  documentType: DocumentType;
  confidentialityLevel?: ConfidentialityLevel;
  validFrom?: string;
  validTo?: string;
  tags?: string[];
  description?: string;
}

export interface UpdateDocumentDto {
  documentType?: DocumentType;
  confidentialityLevel?: ConfidentialityLevel;
  status?: DocumentStatus;
  validFrom?: string;
  validTo?: string;
  tags?: string[];
  description?: string;
}

export interface SearchDocumentDto {
  search?: string;
  entityType?: EntityType;
  entityId?: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  confidentialityLevel?: ConfidentialityLevel;
  uploadedAfter?: string;
  uploadedBefore?: string;
  uploadedById?: string;
  tags?: string;
}

export interface DocumentStatistics {
  total: number;
  byType: Array<{ type: string; count: string }>;
  byEntity: Array<{ type: string; count: string }>;
  totalSize: number;
}
