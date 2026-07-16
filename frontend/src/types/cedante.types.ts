export interface Cedante {
  id: string;
  code: string;
  raisonSociale: string;
  compteComptable: string;
  identifiantUnique?: string;
  resident: boolean;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CedanteContact[];
  bankAccounts?: CedanteBankAccount[];
  isActive?: boolean;
  isAccountLocked?: boolean;
  codeModifiedBy?: string;
  codeModifiedAt?: string;
  oldCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CedanteContact {
  id: string;
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  isDefault?: boolean;
  cedanteId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CedanteBankAccount {
  id: string;
  banque: string;
  agence?: string;
  rib: string;
  swift?: string;
  currency: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// DTOs (API Request/Response)
// ============================================================

export interface CreateCedanteDto {
  compteComptable: string;
  raisonSociale: string;
  rne?: string;
  identifiantUnique: string;
  resident: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCedanteContactDto[];
  bankAccounts?: CreateCedanteBankAccountDto[];
}

export interface UpdateCedanteDto {
  raisonSociale?: string;
  rne?: string;
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateCedanteContactDto[];
  bankAccounts?: CreateCedanteBankAccountDto[];
}

export interface CreateCedanteContactDto {
  nom: string;
  prenom: string;
  poste?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  isDefault?: boolean;
}

export interface CreateCedanteBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  swift?: string;
  currency: string;
  isDefault?: boolean;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface CedantesListResponse {
  data: Cedante[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CedanteSingleResponse {
  data: Cedante;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

export function isValidIdentifiantUnique(value: string): boolean {
  return /^[0-9]{7}[A-Z]$/.test(value);
}

export function isValidCompteComptable(value: string): boolean {
  return /^401200[0-9]{2}$/.test(value);
}

export function getIdentifiantUniqueError(value?: string, resident?: boolean): string | null {
  if (resident && !value) {
    return 'Identifiant unique obligatoire pour les entités tunisiennes (resident = true)';
  }
  if (value && !isValidIdentifiantUnique(value)) {
    return 'Format: 7 chiffres + 1 lettre majuscule (ex: 1234567A)';
  }
  return null;
}

export function getCompteComptableError(value?: string): string | null {
  if (!value) return 'Compte comptable est obligatoire';
  if (!isValidCompteComptable(value)) {
    return 'Format: 401200xx (ex: 40120000)';
  }
  return null;
}
