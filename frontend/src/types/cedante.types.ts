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
  // FIX: removed ville / codePostal — these fields exist on CompanyProfile (ARS's own
  // profile) but NOT on the Cedante Prisma model. They could never be populated by a
  // real API response — dead fields that just invite a form to silently fail to save
  // data typed into them.
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
  prenom?: string;
  poste?: string;
  // FIX: was a single `telephone` + separate `mobile` — backend Contact model uses
  // telephoneFixe / telephoneMobile (Section 5.7: Cédante contacts need "Téléphone
  // fixe, Mobile" as two distinct fields). Field names now match what the API
  // actually returns.
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
  // Optional UI flag for marking a contact as the primary contact.
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
  // FIX: was missing — real cédante/réassureur data includes IBAN separately from
  // RIB (audit Découverte 3: most réassureurs already have IBAN ready to import).
  iban?: string;
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
  // FIX: was required (`identifiantUnique: string`) — backend DTO made this optional
  // specifically to unblock seeding the 20 real cédantes on file, none of which have
  // this field populated. The mandatory-when-resident business rule is still enforced
  // service-side; this type just stops the frontend from rejecting valid submissions
  // the backend now accepts.
  identifiantUnique?: string;
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
  prenom?: string;
  poste?: string;
  // FIX: matches CedanteContact — telephoneFixe / telephoneMobile, not telephone / mobile.
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
}

export interface CreateCedanteBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  // FIX: added — see CedanteBankAccount.iban above.
  iban?: string;
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

// NOTE: CedanteSingleResponse ({ data: Cedante }) intentionally removed — the API
// layer's getOne/create/update calls return the bare Cedante object directly
// (matches how the NestJS controllers actually respond, once the axios interceptor
// unwraps the { success, data, timestamp } envelope). Keeping an unused double-wrapped
// type around invites someone to type a response as `CedanteSingleResponse` and get a
// `.data.data` bug.

// ============================================================
// VALIDATION HELPERS
// ============================================================

export function isValidIdentifiantUnique(value: string): boolean {
  return /^[0-9]{7}[A-Z]$/.test(value);
}

// FIX: was /^401200[0-9]{2}$/ — the exact bug fixed on the backend DTO, reintroduced
// here. This rejected EVERY real cédante account (STAR=40124000, ASTREE=40127000,
// CARTE=40128000, HAYETT=40129000, LLOYD=40122000, BIAT ASSURANCES=40121400,
// MAGHREBIA=40123000...). If this gates client-side form submission, users get a
// false validation error before the request ever reaches the (already-fixed) backend.
// Real fixed prefix is "4012" (general account 40120000), followed by 4 free digits.
export function isValidCompteComptable(value: string): boolean {
  return /^4012[0-9]{4}$/.test(value);
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
    // FIX: message updated to match the corrected format.
    return 'Format: 4012xxxx (ex: 40124000)';
  }
  return null;
}