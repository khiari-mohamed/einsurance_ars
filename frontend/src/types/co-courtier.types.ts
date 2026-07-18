/**
 * CoCourtier (Courtier en réassurance) Types
 *
 * Confirmed structure:
 * - Structure IDENTICAL to Reassureur, INCLUDING identifiantUnique and resident
 *   (confirmed — this file previously said the opposite; corrected here)
 * - 5 tabs (Informations, Contacts, Conventions/Affaires, Bank Accounts, Complémentaires)
 * - Compte comptable format: 401xxxxx (same as Reassureur)
 * - Code format: CCO-0001 (auto-generated)
 * - SWIFT expected but non-blocking for international courtiers (same treatment as
 *   Réassureur — see reassureur.types.ts)
 * - Audit trail for code modifications (admin override)
 */

import { Document } from './ged.types';

// ============================================================
// MAIN ENTITY
// ============================================================

export interface CoCourtier {
  id: string;
  code: string;
  compteComptable: string;
  isAccountLocked: boolean;
  raisonSociale: string;
  rne?: string;
  // FIX: this file's docstring previously said "NO identifiantUnique, NO resident" —
  // confirmed incorrect. CoCourtier is structurally identical to Reassureur,
  // including these two fields.
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;

  codeModifiedBy?: string;
  codeModifiedAt?: string;
  oldCode?: string;

  contacts?: CoCourtierContact[];
  bankAccounts?: CoCourtierBankAccount[];
  documents?: Document[];

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
  prenom?: string;
  poste?: string;
  // FIX: matches Cedante/Reassureur — telephoneFixe / telephoneMobile.
  telephoneFixe?: string;
  telephoneMobile?: string;
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
  // FIX: added, same rationale as Cedante/Reassureur.
  iban?: string;
  swift?: string;
  currency: string;
  isDefault?: boolean;
  coCourtId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// DTOs (API Request/Response)
// ============================================================

export interface CreateCoCourtierDto {
  compteComptable: string;
  raisonSociale: string;
  rne?: string;
  // FIX: added — confirmed CoCourtier does carry these, matching the backend DTO
  // built last round.
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCoCourtierContactDto[];
  bankAccounts?: CreateCoCourtierBankAccountDto[];
}

export interface UpdateCoCourtierDto {
  raisonSociale?: string;
  rne?: string;
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCoCourtierContactDto[];
  bankAccounts?: CreateCoCourtierBankAccountDto[];
}

export interface CreateCoCourtierContactDto {
  nom: string;
  prenom?: string;
  poste?: string;
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
}

export interface CreateCoCourtierBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  iban?: string;
  swift?: string;
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

// NOTE: CoCourtierSingleResponse removed — see cedante.types.ts note.

// ============================================================
// VALIDATION HELPERS (for frontend use)
// ============================================================

export function isValidCoCourtierCompteComptable(value: string): boolean {
  return /^401[0-9]{5}$/.test(value);
}

export function isValidCoCourtierSwift(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value);
}

export function getCoCourtierCompteComptableError(value?: string): string | null {
  if (!value) return 'Compte comptable est obligatoire';
  if (!isValidCoCourtierCompteComptable(value)) {
    return 'Format: 401xxxxx (ex: 40130000)';
  }
  return null;
}

// FIX (new): identifiantUnique validation helper — was entirely absent since the
// field didn't exist on this type before. Mirrors Cedante/Reassureur.
export function isValidCoCourtierIdentifiantUnique(value: string): boolean {
  return /^[0-9]{7}[A-Z]$/.test(value);
}

export function getCoCourtierIdentifiantUniqueError(value?: string, resident?: boolean): string | null {
  if (resident && !value) {
    return 'Identifiant unique obligatoire pour les entités tunisiennes (resident = true)';
  }
  if (value && !isValidCoCourtierIdentifiantUnique(value)) {
    return 'Format: 7 chiffres + 1 lettre majuscule (ex: 1234567A)';
  }
  return null;
}