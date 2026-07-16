/**
 * CoCourtier (Courtier en réassurance) Types
 * 
 * Per June 26 meeting:
 * - CoCourtier structure is IDENTICAL to Reassureur
 * - 5 tabs (Informations, Contacts, Conventions/Affaires, Bank Accounts, Complémentaires)
 * - Compte comptable format: 401xxxxx (same as Reassureur)
 * - NO identifiantUnique, NO resident (these are for Compagnies and Réassureurs only)
 * - Code format: CCO-0001 (auto-generated)
 * - SWIFT required for international courtiers
 * - Audit trail for code modifications (admin override)
 */

import { Document } from './ged.types';

// ============================================================
// MAIN ENTITY
// ============================================================

export interface CoCourtier {
  id: string;
  code: string;                          // CCO-0001, auto-generated
  compteComptable: string;               // 401xxxxx — mandatory, locked after creation
  isAccountLocked: boolean;              // true after creation
  raisonSociale: string;
  rne?: string;                          // Optional
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
  contacts?: CoCourtierContact[];
  bankAccounts?: CoCourtierBankAccount[];
  documents?: Document[];

  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CONTACTS
// ============================================================

export interface CoCourtierContact {
  id: string;
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  email?: string;
  isDefault?: boolean;
  coCourtId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// BANK ACCOUNTS
// ============================================================

export interface CoCourtierBankAccount {
  id: string;
  banque: string;
  agence?: string;
  rib: string;
  swift?: string;                        // Required for international courtiers
  currency: string;                      // TND, USD, EUR...
  isDefault?: boolean;
  coCourtId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// DTOs (API Request/Response)
// ============================================================

/**
 * Create CoCourtier — matches backend CreateCoCourtierDto
 */
export interface CreateCoCourtierDto {
  compteComptable: string;               // 401xxxxx
  raisonSociale: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCoCourtierContactDto[];
  bankAccounts?: CreateCoCourtierBankAccountDto[];
}

/**
 * Update CoCourtier — matches backend UpdateCoCourtierDto
 * Note: compteComptable is LOCKED and cannot be updated
 */
export interface UpdateCoCourtierDto {
  raisonSociale?: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCoCourtierContactDto[];
  bankAccounts?: CreateCoCourtierBankAccountDto[];
}

/**
 * Contact DTO for create/update
 */
export interface CreateCoCourtierContactDto {
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  email?: string;
  isDefault?: boolean;
}

/**
 * Bank Account DTO for create/update
 */
export interface CreateCoCourtierBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  swift?: string;                        // Required for international courtiers
  currency: string;
  isDefault?: boolean;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface CoCourtiersListResponse {
  data: CoCourtier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CoCourtierSingleResponse {
  data: CoCourtier;
}

// ============================================================
// VALIDATION HELPERS (for frontend use)
// ============================================================

/**
 * Check if compteComptable format is valid
 * Format: 401xxxxx (e.g., 40130000)
 */
export function isValidCoCourtierCompteComptable(value: string): boolean {
  return /^401[0-9]{5}$/.test(value);
}

/**
 * Check if SWIFT code format is valid (8 or 11 characters)
 */
export function isValidCoCourtierSwift(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value);
}

/**
 * Get validation error message for compteComptable
 */
export function getCoCourtierCompteComptableError(value?: string): string | null {
  if (!value) return 'Compte comptable est obligatoire';
  if (!isValidCoCourtierCompteComptable(value)) {
    return 'Format: 401xxxxx (ex: 40130000)';
  }
  return null;
}