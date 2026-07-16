/**
 * Assure (Client) Types
 * 
 * Per CDC: Clients (Assurés) have:
 * - 4 tabs only (NO bank accounts, NO compte comptable)
 * - NO identifiantUnique, NO resident (these are for Compagnies and Réassureurs only)
 * - Code format: CLI-0001 (auto-generated)
 * - RNE is optional (legacy field)
 * - Audit trail for code modifications (admin override)
 */

// ============================================================
// MAIN ENTITY
// ============================================================

export interface Assure {
  id: string;
  code: string;                          // CLI-0001, auto-generated
  raisonSociale: string;
  rne?: string;                          // Optional — legacy field
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;      // Contains notes, etc.

  // Audit trail for code modifications (admin override)
  codeModifiedBy?: string;               // User ID who last modified the code
  codeModifiedAt?: string;               // Timestamp of last code modification
  oldCode?: string;                      // Previous code value (for rollback/audit)

  // Relations
  contacts?: AssureContact[];
  facultatives?: FacultativeAffaire[];   // Deals linked to this client

  // Status
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
  prenom: string;
  poste?: string;                        // Changed from 'fonction' to match DTO
  telephone?: string;
  email?: string;
  isDefault?: boolean;                   // Changed from 'principal' to match DTO
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

/**
 * Create Assure — matches backend CreateAssureDto
 */
export interface CreateAssureDto {
  raisonSociale: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateAssureContactDto[];
}

/**
 * Update Assure — matches backend UpdateAssureDto
 */
export interface UpdateAssureDto {
  raisonSociale?: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateAssureContactDto[];
}

/**
 * Contact DTO for create/update
 */
export interface CreateAssureContactDto {
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  isDefault?: boolean;
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

export interface AssureSingleResponse {
  data: Assure;
}