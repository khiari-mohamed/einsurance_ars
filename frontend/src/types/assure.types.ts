/**
 * Assure (Client) Types
 *
 * Per CDC: Clients (Assurés) have:
 * - 4 tabs only (NO bank accounts, NO compte comptable)
 * - NO identifiantUnique, NO resident (these ARE used on Cedante/Reassureur/CoCourtier,
 *   confirmed — but not on Assuré, whose fiche stays intentionally lighter per the CDC)
 * - Code format: CLI-0001 (auto-generated)
 * - RNE is optional
 * - Audit trail for code modifications (admin override)
 */

// ============================================================
// MAIN ENTITY
// ============================================================

export interface AssureDocumentLink {
  id: string;
  document: {
    id: string;
    nom: string;
    originalName?: string;
    mimeType?: string;
    filePath: string;
    documentType?: string;
    statut?: string;
    createdAt: string;
  };
}

export interface Assure {
  id: string;
  code: string;
  raisonSociale: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  deviseParDefaut?: string;
  freeFields?: Record<string, any>;

  codeModifiedBy?: string;
  codeModifiedAt?: string;
  oldCode?: string;

  contacts?: AssureContact[];
  documents?: AssureDocumentLink[];
  facultatives?: FacultativeAffaire[];

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CONTACTS
// ============================================================

export interface AssureContact {
  id: string;
  nom: string;
  prenom?: string;
  poste?: string;
  // FIX: this type previously had ONLY `telephone`, while CreateAssureContactDto
  // (below) had `telephone` AND `mobile` — same entity/DTO split bug as
  // Reassureur. Unified to telephoneFixe/telephoneMobile, matching the shared
  // backend Contact model. Section 5.7's Assuré contact table lists Prénom/Nom/
  // Poste/Téléphone/Email without a separate Mobile column, but the backend Contact
  // model is shared across all 4 entities — keeping the field names consistent here
  // avoids a 5th divergent shape; telephoneMobile is simply left unused/empty for
  // Assuré if the client confirms Assuré truly never needs it.
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
  isDefault?: boolean;
  assureId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// FACULTATIVE AFFAIRE (linked to Assure)
// ============================================================

export interface FacultativeAffaire {
  id: string;
  affaireId: string;
  assureId: string;
  assure?: Assure;
  // ... other facultative fields
}

// ============================================================
// DTOs (API Request/Response)
// ============================================================

export interface CreateAssureDto {
  raisonSociale: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  deviseParDefaut?: string;
  freeFields?: Record<string, any>;
  contacts?: CreateAssureContactDto[];
}

export interface UpdateAssureDto {
  raisonSociale?: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  deviseParDefaut?: string;
  freeFields?: Record<string, any>;
  contacts?: CreateAssureContactDto[];
}

export interface CreateAssureContactDto {
  nom: string;
  prenom?: string;
  poste?: string;
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface AssuresListResponse {
  data: Assure[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// NOTE: AssureSingleResponse removed — see cedante.types.ts note.