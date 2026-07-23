/**
 * CoCourtier (Courtier en réassurance) Types
 *
 * Confirmed structure:
 * - Structure IDENTICAL to Reassureur, INCLUDING identifiantUnique and resident
 * - 5 tabs (Informations, Contacts, Conventions/Affaires, Bank Accounts, Complémentaires)
 * - Compte comptable format: 401xxxxx (same as Reassureur)
 * - Code format: CCO-0001 (auto-generated)
 * - SWIFT expected but non-blocking for international courtiers (same treatment as
 *   Réassureur — see reassureur.types.ts)
 * - Audit trail for code modifications (admin override)
 * - FIX (Co-Courtier pass): added deviseParDefaut + groupKey (schema parity with
 *   Cedante/Reassureur) and a Convention[] relation type used by the new Detail page.
 */

import { Document } from './ged.types';
import { Convention } from './convention.types';

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
  identifiantUnique?: string;
  resident?: boolean;
  // FIX (new): admin/dedup-script field only — see schema comment. Not
  // exposed in the day-to-day create/edit forms.
  groupKey?: string;
  // FIX (new): was on the schema, missing from this type entirely.
  deviseParDefaut?: string;
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
  // FIX (new): relation existed on the backend (Convention model has
  // coCourtId) but had no frontend type — needed for the new Detail page.
  conventions?: Convention[];

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
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  // FIX (new): parity with backend DTO.
  deviseParDefaut?: string;
  groupKey?: string;
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
  deviseParDefaut?: string;
  groupKey?: string;
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

// FIX (new, Co-Courtier pass): CDC §5.7 — "identique au Réassureur" —
// SWIFT/BIC is obligatoire pour internationaux. There was previously no bank
// account form for CoCourtier at all, so this rule had nowhere to live.
export function isSwiftRequiredForCoCourtier(resident?: boolean): boolean {
  return resident === false;
}

export function getCoCourtierSwiftError(value?: string, resident?: boolean): string | null {
  if (resident === false && !value) {
    return 'SWIFT/BIC obligatoire pour une entité non-résidente';
  }
  if (value && !isValidCoCourtierSwift(value)) {
    return 'Format SWIFT invalide (ex: BNPAFRPPXXX)';
  }
  return null;
}