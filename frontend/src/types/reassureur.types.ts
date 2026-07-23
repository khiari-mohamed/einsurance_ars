/**
 * Réassureur Types
 *
 * Matches the backend Prisma schema and DTOs.
 *
 * Key Business Rules:
 * - identifiantUnique is REQUIRED when resident = true (Tunisian entity)
 * - identifiantUnique is OPTIONAL when resident = false (foreign entity)
 * - compteComptable format: 401xxxxx (e.g., 40130000)
 * - swift is normally expected on bank accounts when resident = false (foreign), but
 *   this is a NON-BLOCKING data-quality flag, not a hard requirement — see note below.
 * - code format: REA-0001 (auto-generated)
 * - code can be overridden by SUPER_ADMIN only
 */

// ============================================================
// MAIN ENTITY
// ============================================================

// FIX (new): ReassureursService.findOne() includes `documents: { where: {
// entityType: 'REASSUREUR' }, include: { document: true } }` — was never typed,
// same gap as Cedante had.
export interface ReassureurDocumentLink {
  id: string;
  documentId: string;
  entityType: string; // 'REASSUREUR'
  document: {
    id: string;
    nom: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    documentType?: string;
    createdAt: string;
  };
  createdAt: string;
}

export interface Reassureur {
  id: string;
  code: string;
  compteComptable: string;
  isAccountLocked: boolean;
  raisonSociale: string;
  rne?: string;
  identifiantUnique?: string;
  resident: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;

  codeModifiedBy?: string;
  codeModifiedAt?: string;
  oldCode?: string;

  contacts?: ReassureurContact[];
  bankAccounts?: ReassureurBankAccount[];
  participations?: AffaireReassureur[];
  // FIX (new): see ReassureurDocumentLink above.
  documents?: ReassureurDocumentLink[];

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
  prenom?: string;
  poste?: string;
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
  // FIX (removed): `isDefault` was rendered/edited in the UI (ReassureurDetail's
  // "Principal" badge, ReassureurContactModal's checkbox) but the backend `Contact`
  // Prisma model — shared across Cedante/Reassureur/CoCourtier — has no such field
  // (unlike `BankAccount`, which does have `isDefault`). Every submission of this
  // flag was silently dropped. Removed here so the type doesn't promise something
  // the API can't persist — same fix already applied to CedanteContact.
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
  // FIX: added — real réassureur data includes IBAN (audit Découverte 3: 33/35
  // réassureurs already have IBAN ready to import).
  iban?: string;
  // FIX: was `swift: string` (required). Backend DTO deliberately made this optional
  // — a hard requirement here blocked creation of 3 real named non-resident
  // reassureurs (TUNIS RE, AIG, LIBYA INSURANCE — audit Découverte 3) that currently
  // lack SWIFT in the client's own accounting file. Question 5.6.3 (obligatoire ou
  // optionnel ?) is still open with the client — treat as expected-but-not-blocking
  // until confirmed.
  swift?: string;
  currency: string;
  isDefault?: boolean;
  reassureurId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// PARTICIPATION (Affaire → Réassureur relationship)
// ============================================================

// FIX (new): ReassureursService.findOne() nests `affaire: { include: { cedante:
// true, facultativeData: { include: { assure: true } } } }` inside each
// participation — the field existed in every real API response but was never
// declared on this type, so ReassureurDetail's participations list was reading
// undefined fields (see affaire.numéroPolice / numeroAffaire / reference / category
// fix in ReassureurDetail.tsx — none of those exist on the real Affaire model,
// whose actual fields are `numero` and `type`).
export interface AffaireReassureur {
  id: string;
  affaireId: string;
  reassureurId: string;
  reassureur?: Reassureur;
  affaire?: {
    id: string;
    numero: string;
    type: 'FACULTATIVE' | 'TRAITE';
    statut: 'EN_COTATION' | 'PREVISION' | 'PLACEMENT_REALISE';
    cedante?: { id: string; raisonSociale: string };
    facultativeData?: { assure?: { id: string; raisonSociale: string } };
  };

  partPct: number;
  isLeader: boolean;

  commissionMode: 'CALCULABLE' | 'FORFAITAIRE';
  tauxCommissionArs?: number;
  commissionForfait?: number;

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

export interface CreateReassureurDto {
  compteComptable: string;
  raisonSociale: string;
  rne?: string;
  identifiantUnique?: string;
  resident: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  freeFields?: Record<string, any>;
  contacts?: CreateReassureurContactDto[];
  bankAccounts?: CreateReassureurBankAccountDto[];
}

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

export interface CreateReassureurContactDto {
  nom: string;
  prenom?: string;
  poste?: string;
  telephoneFixe?: string;
  telephoneMobile?: string;
  email?: string;
}

export interface CreateReassureurBankAccountDto {
  banque: string;
  agence?: string;
  rib: string;
  iban?: string;
  // FIX: was required — see ReassureurBankAccount.swift note above.
  swift?: string;
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

// NOTE: ReassureurSingleResponse removed — see cedante.types.ts note (unused,
// double-wrapped, invites a .data.data bug).

// ============================================================
// VALIDATION HELPERS (for frontend use)
// ============================================================

export function isValidIdentifiantUnique(value: string): boolean {
  return /^[0-9]{7}[A-Z]$/.test(value);
}

export function isValidCompteComptable(value: string): boolean {
  return /^401[0-9]{5}$/.test(value);
}

export function isValidSwift(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value);
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
    return 'Format: 401xxxxx (ex: 40130000)';
  }
  return null;
}

/**
 * FIX: was a hard blocking error when !resident && !value — matches the backend's
 * previous hard BadRequestException that we removed (it blocked 3 real named
 * reassureurs). Now returns a WARNING string, not an error, and the caller
 * (form component) should treat this as non-blocking — display it, don't prevent
 * submission. Renamed usage intent via the return type comment below; the function
 * signature stays the same so existing callers don't break, but treat the string as
 * advisory only.
 */
export function getSwiftWarning(value?: string, resident?: boolean): string | null {
  if (!resident && !value) {
    return 'Code SWIFT généralement requis pour les réassureurs non-résidents (à confirmer avec le client — non bloquant)';
  }
  if (value && !isValidSwift(value)) {
    return 'Format SWIFT invalide (8 ou 11 caractères)';
  }
  return null;
}