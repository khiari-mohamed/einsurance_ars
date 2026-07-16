/**
 * Réassureur Types
 * 
 * Matches the backend Prisma schema and DTOs.
 * 
 * Key Business Rules:
 * - identifiantUnique is REQUIRED when resident = true (Tunisian entity)
 * - identifiantUnique is OPTIONAL when resident = false (foreign entity)
 * - compteComptable format: 401xxxxx (e.g., 40130000)
 * - swift is REQUIRED on bank accounts when resident = false (foreign)
 * - code format: REA-0001 (auto-generated)
 * - code can be overridden by SUPER_ADMIN only
 */

// ============================================================
// MAIN ENTITY
// ============================================================

export interface Reassureur {
  id: string;
  code: string;                          // REA-0001, auto-generated
  compteComptable: string;               // 401xxxxx — mandatory, locked after creation
  isAccountLocked: boolean;              // true after creation
  raisonSociale: string;
  rne?: string;                          // Legacy, optional for foreign entities
  identifiantUnique?: string;            // 7 digits + 1 letter (1234567A) — required for Tunisian entities
  resident: boolean;                     // true = Tunisian resident, false = non-resident
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;

  // Audit trail for code modifications (admin override)
  codeModifiedBy?: string;               // User ID who last modified the code
  codeModifiedAt?: string;               // Timestamp of last code modification
  oldCode?: string;                      // Previous code value (for rollback/audit)

  // Relations
  contacts?: ReassureurContact[];
  bankAccounts?: ReassureurBankAccount[];
  participations?: AffaireReassureur[];   // Deals where this reinsurer participates

  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CONTACTS
// ============================================================

export interface ReassureurContact {
  id: string;
  nom: string;
  prenom: string;
  poste?: string;                        // Poste / Fonction
  telephone?: string;
  email?: string;
  isDefault?: boolean;                   // Contact principal
  reassureurId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// BANK ACCOUNTS
// ============================================================

export interface ReassureurBankAccount {
  id: string;
  banque: string;
  agence?: string;
  rib: string;
  swift: string;                         // REQUIRED for non-resident (resident = false)
  currency: string;                      // TND, USD, EUR...
  isDefault?: boolean;
  reassureurId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// PARTICIPATION (Affaire → Réassureur relationship)
// ============================================================

export interface AffaireReassureur {
  id: string;
  affaireId: string;
  reassureurId: string;
  reassureur?: Reassureur;

  partPct: number;                       // Participation % (e.g., 30.00)
  isLeader: boolean;                     // Leader flag

  // ARS commission per reinsurer
  commissionMode: 'CALCULABLE' | 'FORFAITAIRE';
  tauxCommissionArs?: number;            // Used when CALCULABLE
  commissionForfait?: number;            // Used when FORFAITAIRE

  // Calculated — stored for reports and accounting
  primeBrute?: number;
  commissionArs?: number;
  commissionCedante?: number;
  primeNetteCedante?: number;
  primeNetteReassureur?: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// DTOs (API Request/Response)
// ============================================================

/**
 * Create Reassureur — matches backend CreateReassureurDto
 */
export interface CreateReassureurDto {
  compteComptable: string;               // 401xxxxx
  raisonSociale: string;
  rne?: string;
  identifiantUnique?: string;            // Required when resident = true
  resident: boolean;                     // Required
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateReassureurContactDto[];
  bankAccounts?: CreateReassureurBankAccountDto[];
}

/**
 * Update Reassureur — matches backend UpdateReassureurDto
 * Note: compteComptable is LOCKED and cannot be updated
 */
export interface UpdateReassureurDto {
  raisonSociale?: string;
  rne?: string;
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateReassureurContactDto[];
  bankAccounts?: CreateReassureurBankAccountDto[];
}

/**
 * Contact DTO for create/update
 */
export interface CreateReassureurContactDto {
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  isDefault?: boolean;
}

/**
 * Bank Account DTO for create/update
 */
export interface CreateReassureurBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  swift: string;                         // REQUIRED for non-resident
  currency: string;
  isDefault?: boolean;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ReassureursListResponse {
  data: Reassureur[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReassureurSingleResponse {
  data: Reassureur;
}

// ============================================================
// VALIDATION HELPERS (for frontend use)
// ============================================================

/**
 * Check if identifiantUnique format is valid
 * Format: 7 digits + 1 uppercase letter (e.g., 1234567A)
 */
export function isValidIdentifiantUnique(value: string): boolean {
  return /^[0-9]{7}[A-Z]$/.test(value);
}

/**
 * Check if compteComptable format is valid
 * Format: 401xxxxx (e.g., 40130000)
 */
export function isValidCompteComptable(value: string): boolean {
  return /^401[0-9]{5}$/.test(value);
}

/**
 * Check if SWIFT code format is valid (8 or 11 characters)
 */
export function isValidSwift(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value);
}

/**
 * Get validation error message for identifiantUnique
 */
export function getIdentifiantUniqueError(value?: string, resident?: boolean): string | null {
  if (resident && !value) {
    return 'Identifiant unique obligatoire pour les entités tunisiennes (resident = true)';
  }
  if (value && !isValidIdentifiantUnique(value)) {
    return 'Format: 7 chiffres + 1 lettre majuscule (ex: 1234567A)';
  }
  return null;
}

/**
 * Get validation error message for compteComptable
 */
export function getCompteComptableError(value?: string): string | null {
  if (!value) return 'Compte comptable est obligatoire';
  if (!isValidCompteComptable(value)) {
    return 'Format: 401xxxxx (ex: 40130000)';
  }
  return null;
}

/**
 * Get validation error message for SWIFT (non-resident required)
 */
export function getSwiftError(value?: string, resident?: boolean): string | null {
  if (!resident && !value) {
    return 'Code SWIFT obligatoire pour les réassureurs non-résidents';
  }
  if (value && !isValidSwift(value)) {
    return 'Format SWIFT invalide (8 ou 11 caractères)';
  }
  return null;
}