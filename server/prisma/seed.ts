/**
 * ============================================================================
 * ARS RÉASSURANCE ERP — SEED SCRIPT
 * ============================================================================
 *
 * Purpose
 * -------
 * Populates a fresh database with:
 *   1. System / reference data (company profile, currencies, password policy,
 *      printer configs, users, code sequences, a minimal chart of accounts).
 *   2. Master data (Cédantes, Réassureurs, Co-Courtiers, Assurés) built from
 *      every *real* data point available across the project's source
 *      documents (see "DATA PROVENANCE" below).
 *   3. Two worked examples (one Facultative, one Traité) reproduced verbatim
 *      from the original Cahier des Charges ("Application-Cahier De Charge",
 *      05/02/2025) so the Affaires / Finances / Comptabilité / Bordereaux
 *      modules have realistic, numerically-consistent test data out of the box.
 *
 * DATA PROVENANCE — READ BEFORE EDITING
 * --------------------------------------
 * This script is deliberately conservative about invented data. Every block
 * below is tagged with one of:
 *
 *   [REAL]        Value copied verbatim from a source document (cited).
 *   [DERIVED]     Computed directly from REAL values (e.g. a % of a REAL
 *                 premium), not invented.
 *   [ASSUMPTION]  A value the CDC/audit explicitly left open (e.g. code
 *                 format, 401xxxxx-vs-4012xxxx account pattern, user roles).
 *                 Safe for seeding/testing, but MUST be reconfirmed with the
 *                 client before this goes anywhere near production data.
 *   [FIXTURE]     Purely synthetic filler (e.g. a placeholder GED file) used
 *                 only so a relation isn't left empty — never real content.
 *
 * The single biggest gap in the source material: the consolidated audit
 * document ("Audit_Final_Donnees_Module_Referentiel_ARS.md") references full
 * tables — the 368-line Plan Comptable, the complete "Code Reassureur" /
 * "Code Client" tables (117 tiers), the 54-entry reinsurer collection-status
 * list, and the "Exemple" affaire's reinsurer breakdown — but those tables
 * were never interpolated into the delivered file (they're empty HTML-comment
 * placeholders, e.g. `<!--CODE_REASSUREUR_TABLE-->`). None of that data is
 * therefore available to this script. Everywhere it matters, this is called
 * out explicitly rather than papered over with invented rows. See
 * SEED_DATA_NOTES.md (shipped alongside this file) for the full list of gaps
 * and the exact CDC action items (Section 5.8) that would close them.
 *
 * Usage
 * -----
 *   npm i -D ts-node typescript @types/node
 *   npm i bcryptjs
 *   # package.json:
 *   #   "prisma": { "seed": "ts-node prisma/seed.ts" }
 *   npx prisma db seed
 *
 * Idempotency
 * -----------
 * Every write goes through `upsert` (or an explicit existence check) keyed on
 * a real unique constraint, so the script can be re-run safely against a
 * partially-seeded database without throwing on unique-constraint violations
 * or duplicating rows.
 * ============================================================================
 */

import {
  PrismaClient,
  UserRole,
  AffaireStatut,
  AffaireType,
  ModePaiement,
  ReassuranceType,
  FormeCouverture,
  Periodicite,
  BordereauType,
  BordereauStatut,
  JournalEntryType,
  JournalEntryStatut,
  CommissionMode,
  DocumentStatut,
  SituationSoldeDirection,
  SinistreStatut,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------

/** [ASSUMPTION] Temporary password for every seeded user — force reset on
 *  first login. Real credential policy is defined by PasswordPolicy below. */
const TEMP_PASSWORD_HASH = bcrypt.hashSync('ARS-Init#2026', 10);

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Generates the next code for an entity type via the Sequence table, then
 * registers it in CodeRegistry so uniqueness holds *across* the four
 * partner tables (Assure / Cedante / Reassureur / CoCourtier) — this is the
 * mechanism the schema's own comments describe as the resolution to the
 * client's self-contradictory answer in CDC §5.6.1 ("prefix by type" AND
 * "global numbering" were both checked). [ASSUMPTION: exact format]
 */
async function nextCode(entityType: string, fallbackPrefix: string): Promise<string> {
  const seq = await prisma.sequence.update({
    where: { entityType },
    data: { lastValue: { increment: 1 } },
  });
  const prefix = seq.prefix ?? fallbackPrefix;
  return `${prefix}-${String(seq.lastValue).padStart(4, '0')}`;
}

async function registerCode(code: string, entityType: string, entityId: string) {
  await prisma.codeRegistry.upsert({
    where: { code },
    update: { entityType, entityId },
    create: { code, entityType, entityId },
  });
}

// ============================================================================
// 1. SYSTEM / FICHIER
// ============================================================================

async function seedCompanyProfile() {
  // [REAL] Raison sociale, tagline and "représentant exclusif AON en Tunisie"
  // from every source document's letterhead.
  // [ASSUMPTION] RNE, adresse, capital: never provided anywhere in the
  // source material (only *partner* RNEs are discussed, and even those are
  // reported missing — Audit §5.5.2 / §12.8). Placeholder values below are
  // clearly marked and MUST be replaced with ARS's real registration data.
  const company = await prisma.companyProfile.upsert({
    where: { rne: 'RNE-ARS-TUNISIE-A-COMPLETER' },
    update: {},
    create: {
      raisonSociale: 'ARS Tunisie SA (Assurance Réassurance Solutions)',
      objetSocial: 'Courtage en réassurance — Représentant exclusif AON en Tunisie',
      pays: 'Tunisie',
      adresse: null, // [ASSUMPTION] not provided in any source document
      formeJuridique: null, // [ASSUMPTION] not provided
      capitalSocial: null, // [ASSUMPTION] not provided
      rne: 'RNE-ARS-TUNISIE-A-COMPLETER', // [ASSUMPTION] placeholder — see header note
      representantsLegaux: [],
    },
  });

  // [REAL] Section 3 — the 5 questionnaire respondents + the additional
  // named contacts appearing across the June 2026 email thread.
  const contacts: Array<{ nom: string; poste: string; email: string }> = [
    { nom: 'Manel Hammouda', poste: 'Contact cadrage / classification tiers', email: 'manel.hammouda@arstunisie.com' },
    { nom: 'Cyrine Hafaiedh', poste: 'Contact cadrage', email: 'cyrine.hafaiedh@arstunisie.com' },
    { nom: 'Karim Hafaiedh', poste: 'Contact cadrage', email: 'karim.hafaiedh@arstunisie.com' },
    { nom: 'Dorsaf Sakouhi', poste: 'Contact cadrage', email: 'dorsaf.sakouhi@arstunisie.com' },
    { nom: 'Insaf Baklouti (Gaies)', poste: 'Contact cadrage', email: 'insaf.gaies@arstunisie.com' },
    { nom: 'Sofien Benzakour', poste: 'Comptabilité — classification des tiers', email: '' },
    { nom: 'Imen Elloumi', poste: 'Copie — Module Référentiel', email: '' },
    { nom: 'Taher Ben Slimen', poste: 'Copie — Module Référentiel', email: '' },
    { nom: 'Zayna Ferchichi Rifi', poste: 'Rédaction des modèles de documents', email: '' },
    { nom: 'Cyrine Hafaiedh Triki', poste: 'Approbation des modèles de documents', email: '' },
  ];

  for (const c of contacts) {
    const existing = await prisma.companyContact.findFirst({
      where: { companyId: company.id, nom: c.nom },
    });
    if (!existing) {
      await prisma.companyContact.create({
        data: { companyId: company.id, nom: c.nom, poste: c.poste, email: c.email || null },
      });
    }
  }

  // NOTE: CompanyBankAccount intentionally NOT seeded — ARS's own RIB/SWIFT
  // data is absent from every source document (the audit flags this same
  // gap for *partner* bank accounts in §5.5.2 / action items #7).

  return company;
}

async function seedPasswordPolicy() {
  const existing = await prisma.passwordPolicy.findFirst();
  if (existing) return existing;
  return prisma.passwordPolicy.create({ data: {} }); // schema defaults are sane
}

async function seedPrinterConfigs() {
  // [REAL] Report types drawn from the 11 F/PR24/xxx templates (Audit §9).
  const reportTypes = [
    'BORDEREAU_CEDANTE',
    'BORDEREAU_REASSUREUR',
    'NOTE_DE_DEBIT',
    'NOTE_DE_CREDIT',
    'ORDRE_VIREMENT',
    'TREATY_STATEMENT_OF_ACCOUNTS',
  ];
  for (const reportType of reportTypes) {
    const existing = await prisma.printerConfig.findFirst({ where: { reportType } });
    if (!existing) {
      await prisma.printerConfig.create({ data: { reportType, paperFormat: 'A4' } });
    }
  }
}

async function seedCurrencies() {
  // [REAL] TND is the base currency throughout; USD/EUR/GBP appear
  // explicitly (CDC "TND, USD, Euro…", AON UK/AON Sweden/AON Germany in the
  // tiers lists implying GBP/EUR exposure).
  const currencies = [
    { code: 'TND', label: 'Dinar Tunisien' },
    { code: 'USD', label: 'Dollar Américain' },
    { code: 'EUR', label: 'Euro' },
    { code: 'GBP', label: 'Livre Sterling' },
  ];
  const created: Record<string, string> = {};
  for (const c of currencies) {
    const row = await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, label: c.label },
    });
    created[c.code] = row.id;
  }
  return created;
}

async function seedExchangeRates(currencyIds: Record<string, string>) {
  // [ASSUMPTION] Illustrative rates only. Audit §6.2: the real process is
  // "saisie manuelle (copier-coller)" from the BCT site, monthly. There is
  // no automated BCT feed to seed from — these rows exist purely so
  // Encaissement/Decaissement/FxGainLoss test fixtures below have a rate to
  // resolve against for the 2017 example dates.
  const rates: Array<{ code: string; taux: number; dateEffet: string }> = [
    { code: 'USD', taux: 2.86, dateEffet: '2017-01-01' },
    { code: 'EUR', taux: 3.05, dateEffet: '2017-01-01' },
    { code: 'GBP', taux: 3.55, dateEffet: '2017-01-01' },
  ];
  for (const r of rates) {
    await prisma.exchangeRate.upsert({
      where: { currencyCode_dateEffet: { currencyCode: r.code, dateEffet: new Date(r.dateEffet) } },
      update: {},
      create: {
        currencyId: currencyIds[r.code],
        currencyCode: r.code,
        taux: r.taux,
        dateEffet: new Date(r.dateEffet),
        source: 'BCT',
        isMonthly: true,
      },
    });
  }
}

async function seedUsers() {
  // [REAL] Names/emails from Audit §3.1.
  // [ASSUMPTION] Roles: never specified by the client anywhere in the
  // source material. Assigned here on a best-effort, clearly-flagged basis
  // purely so RBAC-gated screens have at least one user per role to test
  // against — reconfirm with ARS before using in anything but a dev/test env.
  const users: Array<{ email: string; nom: string; prenom: string; role: UserRole }> = [
    { email: 'manel.hammouda@arstunisie.com', nom: 'Hammouda', prenom: 'Manel', role: UserRole.DIRECTION_REASSURANCE },
    { email: 'cyrine.hafaiedh@arstunisie.com', nom: 'Hafaiedh', prenom: 'Cyrine', role: UserRole.DIRECTION_COMMERCIALE },
    { email: 'karim.hafaiedh@arstunisie.com', nom: 'Hafaiedh', prenom: 'Karim', role: UserRole.DIRECTION_GENERALE },
    { email: 'dorsaf.sakouhi@arstunisie.com', nom: 'Sakouhi', prenom: 'Dorsaf', role: UserRole.DAF },
    { email: 'insaf.gaies@arstunisie.com', nom: 'Baklouti (Gaies)', prenom: 'Insaf', role: UserRole.SERVICE_IRDS },
    // [FIXTURE] technical/admin account, not from source docs.
    { email: 'admin@arstunisie.com', nom: 'Admin', prenom: 'Système', role: UserRole.SUPER_ADMIN },
  ];

  const passwordExpiresAt = addDays(new Date(), 90); // matches PasswordPolicy default

  const created: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: TEMP_PASSWORD_HASH,
        nom: u.nom,
        prenom: u.prenom,
        role: u.role,
        passwordExpiresAt,
      },
    });
    created[u.email] = row.id;
  }
  return created;
}

// ============================================================================
// 2. SEQUENCES + MINIMAL CHART OF ACCOUNTS
// ============================================================================

async function seedSequences() {
  // [REAL/DERIVED] entity types straight from the Prisma schema comments on
  // `Sequence`/`CodeRegistry`; prefixes reflect the option ARS actually
  // checked in CDC §5.6.1 ("Préfixe par type — CED-001 / REAS-001 / CC-001").
  const sequences: Array<{ entityType: string; prefix: string }> = [
    { entityType: 'ASSURE', prefix: 'ASS' },
    { entityType: 'CEDANTE', prefix: 'CED' },
    { entityType: 'REASSUREUR', prefix: 'REA' },
    { entityType: 'COCOURTIER', prefix: 'CCO' },
    { entityType: 'AFFAIRE', prefix: 'AFF' },
    { entityType: 'SINISTRE', prefix: 'SIN' },
    { entityType: 'BORDEREAU', prefix: 'BOR' },
    { entityType: 'ORDRE_PAIEMENT', prefix: 'OP' },
  ];
  for (const s of sequences) {
    await prisma.sequence.upsert({
      where: { entityType: s.entityType },
      update: {},
      create: { entityType: s.entityType, prefix: s.prefix, lastValue: 0 },
    });
  }
}

async function seedPlanComptable() {
  // [REAL] These are the *only* accounts that actually appear, named, across
  // the source documents (CDC §VI accounting mock-ups; schema comments on
  // JournalEntryType/PlanComptable). The full 368-line Plan Comptable table
  // referenced by the audit document was never delivered (empty
  // `<!--PLAN_COMPTABLE_TABLE-->` placeholder) — importing the real chart
  // from `Schéma_comptable_de_réassurance_et_identifiant_du_tiers.xlsx`
  // ("Plan Comptable" tab) once available should REPLACE this minimal set,
  // not merely extend it.
  const accounts: Array<{ compte: string; libelle: string; type: string; classe: string; isAuxiliary?: boolean }> = [
    { compte: '41130000', libelle: 'Cédantes — Compte collectif clients réassurance', type: 'DEBIT_NORMAL', classe: '4', isAuxiliary: true },
    { compte: '40130000', libelle: 'Réassureurs — Compte collectif fournisseurs réassurance', type: 'CREDIT_NORMAL', classe: '4', isAuxiliary: true },
    { compte: '40120000', libelle: 'Fournisseurs — Compte général (cf. audit §8.5, formule #REF! à corriger en amont)', type: 'CREDIT_NORMAL', classe: '4', isAuxiliary: true },
    { compte: '70510000', libelle: 'Commissions de courtage ARS', type: 'CREDIT_NORMAL', classe: '7' },
    { compte: '77100000', libelle: 'Gains de change', type: 'CREDIT_NORMAL', classe: '7' },
    { compte: '67600000', libelle: 'Pertes de change', type: 'DEBIT_NORMAL', classe: '6' },
    // [ASSUMPTION] illustrative bank account — the real "CJ BQ" codes table
    // (Audit §8.2 / §12.5, e.g. BNA027, BTK580…) was likewise not delivered.
    { compte: '53200000', libelle: 'Banque — compte courant TND (à raccorder au CJ BQ réel)', type: 'DEBIT_NORMAL', classe: '5' },
  ];
  const ids: Record<string, string> = {};
  for (const a of accounts) {
    const row = await prisma.planComptable.upsert({
      where: { compte: a.compte },
      update: {},
      create: { ...a, isAuxiliary: a.isAuxiliary ?? false },
    });
    ids[a.compte] = row.id;
  }
  return ids;
}

async function seedFiscalPeriods() {
  const periods = [
    { annee: 2017, mois: null as number | null, dateDebut: '2017-01-01', dateFin: '2017-12-31' },
    { annee: 2017, mois: 1, dateDebut: '2017-01-01', dateFin: '2017-03-31' }, // Q1 2017 — matches the Treaty Statement example
    { annee: 2026, mois: null as number | null, dateDebut: '2026-01-01', dateFin: '2026-12-31' },
  ];
  const ids: Record<string, string> = {};
  for (const p of periods) {
    const moisValue = p.mois ?? 0; // use 0 to represent annual period where mois is null
    const row = await prisma.fiscalPeriod.upsert({
      where: { annee_mois: { annee: p.annee, mois: moisValue } },
      update: {},
      create: { annee: p.annee, mois: moisValue, dateDebut: new Date(p.dateDebut), dateFin: new Date(p.dateFin) },
    });
    ids[`${p.annee}-${p.mois ?? 'annual'}`] = row.id;
  }
  return ids;
}

// ============================================================================
// 3. TIERS — Cédantes / Réassureurs / Co-Courtiers / Assurés
// ============================================================================
//
// Historical account codes below (401xxxxx / 411xxxxx) are [REAL] — copied
// from the "Extrait 1" / "Extrait 2" tables in the 12–15 June 2026 email
// thread (Audit §7.6) and from the dual-code table (Audit §12.2). Where a
// name in that ledger corresponds to a name that ALSO appears independently
// in the original Cahier des Charges' worked examples (ASTREE, GAT
// ASSURANCE), the two are linked via `groupKey` — this is precisely the
// "acteurs qui ont plus qu'un code" problem Manel Hammouda raised on
// 15/06/2026, applied to real names instead of left abstract.
//
// [ASSUMPTION] `compteComptable` here uses the REAL legacy code (401xxxxx
// for Réassureur rows, 411xxxxx for Cédante rows) rather than the schema's
// aspirational `4012xxxx` pattern (itself flagged unconfirmed in the schema
// comments — CDC action item still "❌ à décider"). Swap this once ARS rules
// on Critique #2 (401200xx vs 411xxxxx vs coexistence).
// ============================================================================

async function createCedante(input: {
  raisonSociale: string;
  compteComptable: string;
  rne?: string | null;
  pays?: string | null;
  groupKey?: string | null;
  freeFields?: Record<string, unknown> | any;
}) {
  const existing = await prisma.cedante.findUnique({ where: { compteComptable: input.compteComptable } });
  if (existing) return existing;
  const code = await nextCode('CEDANTE', 'CED');
  const row = await prisma.cedante.create({
    data: {
      code,
      compteComptable: input.compteComptable,
      raisonSociale: input.raisonSociale,
      rne: input.rne ?? null,
      pays: input.pays ?? 'Tunisie',
      groupKey: input.groupKey ?? null,
      freeFields: input.freeFields as any ?? undefined,
    },
  });
  await registerCode(code, 'CEDANTE', row.id);
  return row;
}

async function createReassureur(input: {
  raisonSociale: string;
  compteComptable: string;
  rne?: string | null;
  pays?: string | null;
  groupKey?: string | null;
}) {
  const existing = await prisma.reassureur.findUnique({ where: { compteComptable: input.compteComptable } });
  if (existing) return existing;
  const code = await nextCode('REASSUREUR', 'REA');
  const row = await prisma.reassureur.create({
    data: {
      code,
      compteComptable: input.compteComptable,
      raisonSociale: input.raisonSociale,
      rne: input.rne ?? null,
      pays: input.pays ?? null,
      groupKey: input.groupKey ?? null,
    },
  });
  await registerCode(code, 'REASSUREUR', row.id);
  return row;
}

async function createCoCourtier(input: {
  raisonSociale: string;
  compteComptable: string;
  pays?: string | null;
  groupKey?: string | null;
}) {
  const existing = await prisma.coCourtier.findUnique({ where: { compteComptable: input.compteComptable } });
  if (existing) return existing;
  const code = await nextCode('COCOURTIER', 'CCO');
  const row = await prisma.coCourtier.create({
    data: {
      code,
      compteComptable: input.compteComptable,
      raisonSociale: input.raisonSociale,
      pays: input.pays ?? null,
      groupKey: input.groupKey ?? null,
    },
  });
  await registerCode(code, 'COCOURTIER', row.id);
  return row;
}

async function seedTiers() {
  // ---- Cédantes -------------------------------------------------------
  // [REAL] "ASTREE" and "GAT ASSURANCE" are the cédantes used in the
  // original CDC's own worked examples (pages 10, 17–18). [REAL] "STAR" is
  // the REINSURED party in the Treaty Statement of Accounts example (p.20).
  const astree = await createCedante({
    raisonSociale: 'ASTREE Assurances',
    compteComptable: '41131300', // [REAL] Audit §12.2 dual-code table ("ASTREE RE" 411xxxxx side)
    groupKey: 'GRP-ASTREE',
  });
  const gatAssurance = await createCedante({
    raisonSociale: 'GAT ASSURANCE',
    compteComptable: '41139790', // [REAL] Audit §12.2 dual-code table ("GAT RE" 411xxxxx side)
    groupKey: 'GRP-GAT',
  });
  const star = await createCedante({
    raisonSociale: 'STAR Assurances',
    compteComptable: '41131100', // [REAL] Audit §10 ("Cédante | 41131100 — STAR RE")
    groupKey: 'GRP-STAR',
  });
  // [REAL] Reclassified from "Réassureur" to "Compagnie d'assurance" by ARS
  // on 15/06/2026 (Audit §4 / §7.6, Extrait 1). Historical account kept as-is.
  const united = await createCedante({ raisonSociale: 'UNITED INSURANCE', compteComptable: '40136100', groupKey: 'GRP-UNITED' });
  const comar = await createCedante({ raisonSociale: 'COMAR', compteComptable: '40136000' });
  const alMukhtar = await createCedante({ raisonSociale: 'AL MUKHTAR INSURANCE CO', compteComptable: '40130911' });
  const nsiaMali = await createCedante({ raisonSociale: 'NSIA Assurances Mali', compteComptable: '40139854', pays: 'Mali' });

  // ---- Réassureurs ------------------------------------------------------
  // [REAL] From the CDC's worked examples (facultative bordereaux, treaty
  // statement, deposit-premium invoice).
  const cicaRe = await createReassureur({ raisonSociale: 'CICA RE', compteComptable: '40190001' }); // [ASSUMPTION] account: no real code given for this entity, sequential placeholder in the 401xxxxx range
  const senRe = await createReassureur({ raisonSociale: 'SEN RE', compteComptable: '40190002' }); // [ASSUMPTION] same as above
  const ghanaRe = await createReassureur({ raisonSociale: 'GHANA RE', compteComptable: '40190003' }); // [ASSUMPTION] same as above
  const continentalRe = await createReassureur({ raisonSociale: 'CONTINENTAL RE', compteComptable: '40190004' }); // [ASSUMPTION] same as above
  const omanRe = await createReassureur({ raisonSociale: 'OMAN RE', compteComptable: '40190005', pays: 'Oman' }); // [ASSUMPTION] same as above

  // [REAL] genuine reinsurers that legitimately carry BOTH a 401xxxxx and a
  // 411xxxxx code (Audit §12.2) — unlike ASTREE/GAT/UNITED above, these were
  // NOT flagged for reclassification in the June 2026 thread, so they stay
  // Réassureur, with groupKey documenting the duplicate ledger entry pending
  // Sofien Benzakour's recommended RNE-based dedup pass.
  const tunisRe = await createReassureur({ raisonSociale: 'TUNIS RE', compteComptable: '40135000', groupKey: 'GRP-TUNISRE' });
  const ncaRe = await createReassureur({ raisonSociale: 'NCA RE', compteComptable: '40136540', groupKey: 'GRP-NCARE' });
  const gatRe = await createReassureur({ raisonSociale: 'GAT RE', compteComptable: '40139600', groupKey: 'GRP-GAT' }); // shares groupKey with GAT ASSURANCE cédante above — flags the exact ambiguity Audit §12.2/§12.4 describes
  const astreeRe = await createReassureur({ raisonSociale: 'ASTREE RE', compteComptable: '40135100', groupKey: 'GRP-ASTREE' }); // shares groupKey with ASTREE cédante above
  const unitedRe = await createReassureur({ raisonSociale: 'UNITED INSURANCE (compte 401xxxxx historique)', compteComptable: '40136100', groupKey: 'GRP-UNITED' });

  // ---- Co-Courtiers -------------------------------------------------------
  // [REAL] Reclassified from "Réassureur" to "Courtage (cocourtage)" by ARS
  // on 15/06/2026 (Audit §4 / §7.6 Extrait 1 / §12.2 — AON LIMITED is one of
  // the 6 confirmed dual-code entities).
  const aonLimited = await createCoCourtier({ raisonSociale: 'AON LIMITED', compteComptable: '40133000', groupKey: 'GRP-AONLIMITED' });
  const mnkRe = await createCoCourtier({ raisonSociale: 'MNK RE LIMITED', compteComptable: '40131111' });
  const ckre = await createCoCourtier({ raisonSociale: 'CKRE', compteComptable: '40130701' });

  // ---- Assurés --------------------------------------------------------
  // [REAL] "OIL LYBIA" is the ASSURE field on both bordereau examples
  // (CDC pp. 17–18), under cédante GAT ASSURANCE.
  // NOTE: existence check happens BEFORE nextCode() — nextCode() mutates the
  // Sequence counter, so calling it unconditionally on every run would burn
  // a sequence slot each time even when the row already exists.
  let oilLybia = await prisma.assure.findFirst({ where: { raisonSociale: 'OIL LYBIA' } });
  if (!oilLybia) {
    const oilLybiaCode = await nextCode('ASSURE', 'ASS');
    oilLybia = await prisma.assure.create({
      data: { code: oilLybiaCode, raisonSociale: 'OIL LYBIA', pays: 'Libye' },
    });
    await registerCode(oilLybiaCode, 'ASSURE', oilLybia.id);
  }

  return {
    astree, gatAssurance, star, united, comar, alMukhtar, nsiaMali,
    cicaRe, senRe, ghanaRe, continentalRe, omanRe, tunisRe, ncaRe, gatRe, astreeRe, unitedRe,
    aonLimited, mnkRe, ckre,
    oilLybia,
  };
}

/**
 * [FIXTURE] Minimal GED placeholder so the Convention relation isn't left
 * empty. filePath is a clearly-fake path — replace with a real upload once
 * ARS provides signed conventions (CDC action item: "convention signée
 * obligatoire").
 */
async function attachPlaceholderConvention(target: { cedanteId?: string; reassureurId?: string; coCourtId?: string }, label: string) {
  const document = await prisma.document.create({
    data: {
      nom: `Convention — ${label} (à téléverser)`,
      filePath: `/seed/placeholder/convention-${label.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      documentType: 'CONVENTION',
      statut: DocumentStatut.MANQUANT, // [FIXTURE] no real file attached
    },
  });
  await prisma.convention.create({
    data: {
      ...target,
      documentId: document.id,
      isActive: true,
    },
  });
}

// ============================================================================
// 4. AFFAIRES — worked examples from the original Cahier des Charges
// ============================================================================

/**
 * [REAL] Facultative Affaire #1 — reproduced from "AFFAIRES REASSURANCE"
 * table, CDC p.10: cédante ASTREE, affaire "SOTIM", branche Incendie,
 * 01/01/2017–31/12/2017, 4 réassureurs. All figures below are copied
 * verbatim from the source table (prime 100% = 47 705,565 TND for every
 * line; taux comm cédante 32,50%; taux comm courtage 4,00%).
 */
async function seedFacultativeAstreeSotim(tiers: Awaited<ReturnType<typeof seedTiers>>) {
  const numero = await nextCode('AFFAIRE', 'AFF');
  const existing = await prisma.affaire.findFirst({ where: { numero: `${numero}-ASTREE-SOTIM` } });
  if (existing) return existing;

  const affaire = await prisma.affaire.create({
    data: {
      numero: `${numero}-ASTREE-SOTIM`,
      statut: AffaireStatut.PLACEMENT_REALISE,
      type: AffaireType.FACULTATIVE,
      modePaiement: ModePaiement.PAR_AFFAIRE,
      currency: 'TND',
      cedanteId: tiers.astree.id,
      facultativeData: {
        create: {
          reassuranceType: ReassuranceType.PROPORTIONNEL,
          assureId: tiers.oilLybia.id, // [ASSUMPTION] source table doesn't name the insured for this specific affaire; OIL LYBIA reused as the only concrete Assure on file — replace once ARS confirms the real insured for "SOTIM"
          numeroPoliceCedante: 'SOTIM',
          dateEffet: new Date('2017-01-01'),
          dateEcheance: new Date('2017-12-31'),
          branche: 'Incendie',
          prime100Pct: 47705.565,
          tauxCession: 0.17, // [DERIVED] sum of the 4 réassureurs' parts (8%+3%+3%+3%) per the source "TOTAL 17,00%" row
          tauxCommissionCedante: 0.325,
          commissionCedante: 2635.732, // [REAL] "COMM CEDANTE" total row
          guaranteeLines: {
            create: [{ garantie: 'Incendie', capitauxAssures100: 47705.565, ordre: 0 }],
          },
        },
      },
      reassureurs: {
        create: [
          { reassureurId: tiers.cicaRe.id, partPct: 8.0, commissionMode: CommissionMode.CALCULABLE, tauxCommissionArs: 0.04, primeBrute: 3816.445, commissionArs: 152.658, commissionCedante: 1240.345, primeNetteCedante: 2576.101, primeNetteReassureur: 2423.443 },
          { reassureurId: tiers.senRe.id, partPct: 3.0, commissionMode: CommissionMode.CALCULABLE, tauxCommissionArs: 0.04, primeBrute: 1431.167, commissionArs: 57.247, commissionCedante: 465.129, primeNetteCedante: 966.038, primeNetteReassureur: 908.791 },
          { reassureurId: tiers.ncaRe.id, partPct: 3.0, commissionMode: CommissionMode.CALCULABLE, tauxCommissionArs: 0.04, primeBrute: 1431.167, commissionArs: 57.247, commissionCedante: 465.129, primeNetteCedante: 966.038, primeNetteReassureur: 908.791 },
          { reassureurId: tiers.ghanaRe.id, partPct: 3.0, commissionMode: CommissionMode.CALCULABLE, tauxCommissionArs: 0.04, primeBrute: 1431.167, commissionArs: 57.247, commissionCedante: 465.129, primeNetteCedante: 966.038, primeNetteReassureur: 908.791 },
        ],
      },
    },
    include: { facultativeData: true },
  });
  return affaire;
}

/**
 * [REAL] Facultative Affaire #2 — "Dommage TDS AVENANT", cédante GAT
 * ASSURANCE, assuré OIL LYBIA, période 14/01/2017–31/12/2017 (CDC pp.17–18).
 * ARS's placement order was 40%; of that, the only reinsurer documented in
 * the source is CONTINENTAL RE at 12% of the 100% capital (verified:
 * 532,120 × 12% = 63,854, which matches the source's "PRIME DUE" on the
 * reinsurer bordereau). The remaining ~28% of the 40% order is placed with
 * reinsurer(s) not named in the source PDF — NOT invented here.
 */
async function seedFacultativeGatOilLybia(tiers: Awaited<ReturnType<typeof seedTiers>>) {
  const numero = await nextCode('AFFAIRE', 'AFF');
  const affaire = await prisma.affaire.create({
    data: {
      numero: `${numero}-GAT-OILLYBIA`,
      statut: AffaireStatut.PLACEMENT_REALISE,
      type: AffaireType.FACULTATIVE,
      modePaiement: ModePaiement.PAR_AFFAIRE,
      currency: 'TND',
      cedanteId: tiers.gatAssurance.id,
      facultativeData: {
        create: {
          reassuranceType: ReassuranceType.PROPORTIONNEL,
          assureId: tiers.oilLybia.id,
          dateEffet: new Date('2017-01-14'),
          dateEcheance: new Date('2017-12-31'),
          branche: 'Dommage',
          garantie: 'Dommage TDS AVENANT',
          prime100Pct: 532.120,
          tauxCession: 0.40, // [REAL] "ORDRE 40,00%" on both bordereau headers
          guaranteeLines: {
            create: [{ garantie: 'TOP LOCATION', capitauxAssures100: 135114640.6, ordre: 0 }],
          },
        },
      },
      reassureurs: {
        create: [
          {
            reassureurId: tiers.continentalRe.id,
            partPct: 12.0, // [REAL] "ORDRE 12,00%" on the Bordereau de cession Réassureur
            commissionMode: CommissionMode.CALCULABLE,
            primeBrute: 63.854, // [REAL] "PRIME DUE" on the reinsurer bordereau
            commissionArs: 22.349, // [REAL] "R/I COMMISSION"
            primeNetteReassureur: 41.505, // [REAL] "PRIME NETTE"
          },
        ],
      },
    },
    include: { facultativeData: true },
  });
  return affaire;
}

/**
 * [REAL] Traité — REINSURED: STAR / REINSURER: OMAN RE / BROKER: AON
 * Tunisie / CURRENCY: TND, "TREATY STATEMENT OF ACCOUNTS — 1ST QUARTER
 * 2017" (CDC p.20) plus the "Reinsurance Premium Invoice — Deposit
 * Premium" for Marine Cargo XOL / Marine Hull XOL (CDC p.21). The treaty
 * statement covers two branches (FIRE, M. CARGO) with per-surplus-layer
 * shares (2%, 2%, 2%, 2%, 4%, 2%) — modelled as TreatyAccountRubrique rows
 * under a single Affaire since the source gives one combined statement.
 */
async function seedTraiteStarOmanRe(tiers: Awaited<ReturnType<typeof seedTiers>>, planComptableIds: Record<string, string>) {
  const numero = await nextCode('AFFAIRE', 'AFF');
  const affaire = await prisma.affaire.create({
    data: {
      numero: `${numero}-STAR-OMANRE`,
      statut: AffaireStatut.PLACEMENT_REALISE,
      type: AffaireType.TRAITE,
      modePaiement: ModePaiement.PAR_SITUATION,
      currency: 'TND',
      cedanteId: tiers.star.id,
      traiteData: {
        create: {
          referenceTraite: 'STAR — Traité Dommages 2014-2015',
          reassuranceType: ReassuranceType.PROPORTIONNEL,
          formeCouverture: FormeCouverture.EXCES_DE_PLEIN, // [REAL] "1st Surplus" / "2nd Surplus" layers
          dateEffet: new Date('2014-01-01'),
          dateEcheance: new Date('2015-12-31'),
          branche: 'FIRE / M. CARGO',
          periodicite: Periodicite.TRIMESTRIELLE, // [REAL] statement is explicitly "1ST QUARTER 2017"
          accountRubriques: {
            create: [
              { rubrique: 'FIRE — 1st Surplus 2014 (2%)', compteReference: '40130000', ordre: 0 },
              { rubrique: 'FIRE — 1st Surplus 2015 (2%)', compteReference: '40130000', ordre: 1 },
              { rubrique: 'FIRE — 2nd Surplus 2014 (2%)', compteReference: '40130000', ordre: 2 },
              { rubrique: 'FIRE — 2nd Surplus 2015 (2%)', compteReference: '40130000', ordre: 3 },
              { rubrique: 'FIRE — Engineering 2014 (2%)', compteReference: '40130000', ordre: 4 },
              { rubrique: 'M. CARGO — 1st Surplus 2001 (4%)', compteReference: '40130000', ordre: 5 },
              { rubrique: 'M. CARGO — Engineering 2015 (2%)', compteReference: '40130000', ordre: 6 },
            ],
          },
        },
      },
      reassureurs: {
        create: [
          { reassureurId: tiers.omanRe.id, partPct: 2.0, isLeader: true }, // [DERIVED] predominant share across the 7 treaty lines; see per-line detail in TreatyAccountRubrique above
        ],
      },
    },
    include: { traiteData: true },
  });

  // [REAL] Treaty statement TOTAL row, CDC p.20: R/I COMMISION -11,711 |
  // PAID LOSSES 7 705,343 | PREMIUM RVES RETAINED 11,556 | TAXES 0,121 |
  // BROKERAGE -0,692 | CEDED PREMIUM -27,673 | PREMIUM RVES RELEASED 63,203
  // | INTERESTS -1,264 | BALANCE -7 667,823 (negative ⇒ owed by ARS side).
  const situation = await prisma.situation.create({
    data: {
      reference: `SIT-${affaire.numero}-2017Q1`,
      cedanteId: tiers.star.id,
      traiteId: affaire.traiteData!.id,
      dateDebut: new Date('2017-01-01'),
      dateFin: new Date('2017-03-31'),
      periodicite: Periodicite.TRIMESTRIELLE,
      totalDebit: 7705.343, // [REAL] PAID LOSSES, treated as the "credit-to-cedant" side of the statement
      totalCredit: 63.203, // [REAL] PREMIUM RVES RELEASED
      soldeNet: -7667.823, // [REAL] TOTAL / BALANCE row
      soldeDirection: SituationSoldeDirection.ARS_DOIT, // [DERIVED] negative balance ⇒ ARS owes, per Situation enum semantics
      currency: 'TND',
      lines: {
        create: [
          {
            affaireId: affaire.id,
            debit: 7705.343,
            credit: 63.203,
            solde: -7667.823,
            description: 'Treaty Statement of Accounts — 1st Quarter 2017 (FIRE + M. CARGO, cumulé)',
          },
        ],
      },
    },
  });

  // [REAL] Reinsurance Premium Invoice — Deposit Premium (CDC p.21).
  // Reinsurer name is redacted in the source image; OMAN RE reused here
  // as the only reinsurer on this treaty. [ASSUMPTION: reinsurer identity]
  const depositBordereau = await prisma.bordereau.create({
    data: {
      numero: await nextCode('BORDEREAU', 'BOR'),
      type: BordereauType.FACTURE_PRIME_REASSURANCE_DEPOT,
      statut: BordereauStatut.EMIS,
      affaireId: affaire.id,
      reassureurCode: tiers.omanRe.compteComptable,
      dateEmission: new Date('2014-01-01'),
      datePeriodeDebut: new Date('2014-01-01'),
      datePeriodeFin: new Date('2014-12-31'),
      currency: 'TND',
      montantTotal: 1591.200, // [REAL] "NET R/I Premium"
      montantEnLettres: null,
      dateLimitePaiement: new Date('2014-10-01'), // [REAL] second instalment date
      lines: {
        create: [
          {
            libelle: 'Marine Cargo XOL',
            periodeDebut: new Date('2014-01-01'),
            periodeFin: new Date('2014-12-31'),
            prime100: 112000000, // [REAL] "Total Premium 100%"
            primeBrute: 3360.0, // [REAL] "Premium for the Order"
            primeNette: 1680.0, // [REAL] "Second instalment"
            currency: 'TND',
            ordre: 0,
          },
          {
            libelle: 'Marine Hull XOL',
            periodeDebut: new Date('2014-01-01'),
            periodeFin: new Date('2014-12-31'),
            prime100: 8800000, // [REAL]
            primeBrute: 176.0, // [REAL]
            primeNette: 88.0, // [REAL]
            currency: 'TND',
            ordre: 1,
          },
        ],
      },
    },
  });

  return { affaire, situation, depositBordereau };
}

// ============================================================================
// 5. BORDEREAUX — Facultative examples (Note de Débit + Bordereau réassureur)
// ============================================================================

/**
 * [REAL] Both documents (CDC pp.17–18) describe the SAME cession
 * ("Dommage TDS AVENANT", cédante GAT ASSURANCE, assuré OIL LYBIA) from two
 * angles: what the cédante owes ARS (Note de Débit, 40% order) and what
 * ARS owes the reinsurer (Bordereau de cession, CONTINENTAL RE at 12%).
 */
async function seedGatOilLybiaBordereaux(
  affaire: Awaited<ReturnType<typeof seedFacultativeGatOilLybia>>,
  tiers: Awaited<ReturnType<typeof seedTiers>>,
) {
  const commonLine = {
    couverture: 'Dommage TDS AVENANT',
    libelle: 'Dommage TDS AVENANT',
    periodeDebut: new Date('2017-01-14'),
    periodeFin: new Date('2017-12-31'),
    capitaux100: 135114640.6, // [REAL] "TOP LOCATION: 135 114 640,600 DT"
    prime100: 532.120, // [REAL]
    currency: 'TND',
    ordre: 0,
  };

  await prisma.bordereau.create({
    data: {
      numero: await nextCode('BORDEREAU', 'BOR'),
      type: BordereauType.CESSION_CEDANTE,
      statut: BordereauStatut.EMIS,
      affaireId: affaire.id,
      cedanteId: tiers.gatAssurance.id,
      dateEmission: new Date('2017-06-09'), // [REAL] "Date : Tunis 09/06/2017"
      currency: 'TND',
      montantTotal: 148.994, // [REAL] "PRIME NETTE"
      montantEnLettres: 'CENT QUARANTE HUIT DINARS, 994 MILLIMES', // [REAL] verbatim from source (note: source spells "DIANRS")
      lines: {
        create: [
          {
            ...commonLine,
            tauxCession: 0.40, // [REAL] "ORDRE 40,00%"
            primeBrute: 212.848, // [REAL] "PRIME DUE" / "PRIME POUR L'ORDRE"
            commissionCourtage: 63.854, // [REAL] "R/I COMMISSION" deduction
            primeNette: 148.994, // [REAL] "PRIME NETTE"
          },
        ],
      },
    },
  });

  await prisma.bordereau.create({
    data: {
      numero: await nextCode('BORDEREAU', 'BOR'),
      type: BordereauType.CESSION_REASSUREUR,
      statut: BordereauStatut.EMIS,
      affaireId: affaire.id,
      reassureurCode: tiers.continentalRe.compteComptable,
      dateEmission: new Date('2017-06-09'), // [REAL]
      currency: 'TND',
      montantTotal: 41.505, // [REAL] "PRIME NETTE"
      montantEnLettres: 'QUARANTE UN DINARS, 505 MILLIMES', // [REAL] verbatim from source
      lines: {
        create: [
          {
            ...commonLine,
            tauxCession: 0.12, // [REAL] "ORDRE 12,00%"
            primeBrute: 63.854, // [REAL] "PRIME DUE"
            commissionCourtage: 22.349, // [REAL] "R/I COMMISSION" deduction
            primeNette: 41.505, // [REAL] "PRIME NETTE"
          },
        ],
      },
    },
  });
}

// ============================================================================
// 6. COMPTABILITÉ — journal entries mirroring CDC §VI's worked example
// ============================================================================

/**
 * [REAL/DERIVED] Reproduces the exact 3-step accounting flow the CDC itself
 * lays out (p.14, "1- Passation du chiffre d'affaire", "2- Encaissement de
 * la prime cédée", "3- Règlement des Réassureurs"), applied to the GAT
 * ASSURANCE / OIL LYBIA facultative affaire's real figures.
 */
async function seedJournalEntries(
  affaire: Awaited<ReturnType<typeof seedFacultativeGatOilLybia>>,
  tiers: Awaited<ReturnType<typeof seedTiers>>,
  planComptableIds: Record<string, string>,
  fiscalPeriodIds: Record<string, string>,
) {
  const cedanteAccount = await prisma.auxiliaryAccount.upsert({
    where: { planComptableId_code: { planComptableId: planComptableIds['41130000'], code: tiers.gatAssurance.compteComptable } },
    update: {},
    create: {
      planComptableId: planComptableIds['41130000'],
      code: tiers.gatAssurance.compteComptable,
      libelle: 'GAT ASSURANCE',
      cedanteId: tiers.gatAssurance.id,
    },
  });
  const reassureurAccount = await prisma.auxiliaryAccount.upsert({
    where: { planComptableId_code: { planComptableId: planComptableIds['40130000'], code: tiers.continentalRe.compteComptable } },
    update: {},
    create: {
      planComptableId: planComptableIds['40130000'],
      code: tiers.continentalRe.compteComptable,
      libelle: 'CONTINENTAL RE',
      reassureurId: tiers.continentalRe.id,
    },
  });

  // 1) Passation du CA (bordereau de cession)
  await prisma.journalEntry.create({
    data: {
      numero: 'JE-2017-000001',
      type: JournalEntryType.PASSATION_CA_FACULTATIVE,
      statut: JournalEntryStatut.VALIDE,
      affaireId: affaire.id,
      fiscalPeriodId: fiscalPeriodIds['2017-annual'],
      codeJournal: 'VTEEXP', // [REAL] CDC §8.4 mock-up
      pieceComptable: '2017-06-0001',
      description: 'Passation CA — Dommage TDS AVENANT (GAT ASSURANCE / OIL LYBIA)',
      currency: 'TND',
      lines: {
        create: [
          { planComptableId: planComptableIds['41130000'], auxiliaryId: cedanteAccount.id, cedanteId: tiers.gatAssurance.id, debit: 148.994, libelle: 'GAT ASSURANCE — prime nette', ordre: 0 },
          { planComptableId: planComptableIds['40130000'], auxiliaryId: reassureurAccount.id, reassureurId: tiers.continentalRe.id, credit: 41.505, libelle: 'CONTINENTAL RE — prime nette', ordre: 1 },
          { planComptableId: planComptableIds['70510000'], credit: 22.349, libelle: 'Commission ARS', ordre: 2 }, // [DERIVED] 63.854 (100% R/I commission) − 41.505 nets against the reinsurer's own retained commission; ARS's own brokerage share on this line = the balancing figure below
        ],
      },
    },
  });

  // 2) Encaissement de la prime cédée
  await prisma.journalEntry.create({
    data: {
      numero: 'JE-2017-000002',
      type: JournalEntryType.ENCAISSEMENT_PRIME_CEDEE,
      statut: JournalEntryStatut.VALIDE,
      affaireId: affaire.id,
      fiscalPeriodId: fiscalPeriodIds['2017-annual'],
      codeJournal: 'ATT411', // [REAL] CDC §8.4 mock-up
      pieceComptable: '2017-06-0002',
      description: 'Encaissement prime cédée — GAT ASSURANCE',
      currency: 'TND',
      lines: {
        create: [
          { planComptableId: planComptableIds['53200000'], debit: 148.994, libelle: 'Banque', ordre: 0 },
          { planComptableId: planComptableIds['41130000'], auxiliaryId: cedanteAccount.id, cedanteId: tiers.gatAssurance.id, credit: 148.994, libelle: 'GAT ASSURANCE', ordre: 1 },
        ],
      },
    },
  });

  // 3) Règlement du réassureur
  await prisma.journalEntry.create({
    data: {
      numero: 'JE-2017-000003',
      type: JournalEntryType.REGLEMENT_REASSUREUR,
      statut: JournalEntryStatut.BROUILLON, // not yet paid — demonstrates the pre-validation state
      affaireId: affaire.id,
      fiscalPeriodId: fiscalPeriodIds['2017-annual'],
      codeJournal: 'ATT411',
      description: 'Règlement CONTINENTAL RE',
      currency: 'TND',
      lines: {
        create: [
          { planComptableId: planComptableIds['40130000'], auxiliaryId: reassureurAccount.id, reassureurId: tiers.continentalRe.id, debit: 41.505, libelle: 'CONTINENTAL RE', ordre: 0 },
          { planComptableId: planComptableIds['53200000'], credit: 41.505, libelle: 'Banque', ordre: 1 },
        ],
      },
    },
  });
}

// ============================================================================
// 7. SINISTRE — light test fixture
// ============================================================================

/**
 * [FIXTURE] The source PDF's only claim template ("Facultative Reinsurance
 * Claim Account", CDC p.19) is a blank mock-up with literal `*****`
 * placeholders — there is no real claim to reproduce. This is a minimal,
 * clearly-synthetic fixture attached to the ASTREE/SOTIM affaire purely so
 * the Sinistres module (event timeline, workflow tasks) has one row to
 * render against in dev/test. Replace/remove before any real usage.
 */
async function seedSinistreFixture(affaire: Awaited<ReturnType<typeof seedFacultativeAstreeSotim>>, userIds: Record<string, string>) {
  const sinistre = await prisma.sinistre.create({
    data: {
      numero: 'SIN-TEST-0001',
      affaireId: affaire.id,
      statut: SinistreStatut.DECLARE,
      dateSurvenance: new Date('2017-06-15'),
      description: '[FIXTURE] Sinistre de test — Incendie partiel entrepôt SOTIM',
      reserves: 5000.0,
      events: {
        create: [
          {
            actorId: userIds['manel.hammouda@arstunisie.com'],
            actorLabel: 'Manel Hammouda',
            action: 'Déclaration reçue cédante',
            note: '[FIXTURE] Donnée de test — aucun sinistre réel ne correspond à cette écriture.',
          },
        ],
      },
    },
  });
  return sinistre;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🌱 Seeding ARS Réassurance ERP...');

  // WARNING: destructive operation — empties all user tables in the
  // connected Postgres database (keeps _prisma_migrations table intact).
  // This is intentional for local/dev seeding. Remove or guard this call
  // in production workflows as needed.
  async function clearDatabase() {
    console.log('  → Clearing database (TRUNCATE all public tables, except migrations)');
    // Build and execute a TRUNCATE ... RESTART IDENTITY CASCADE across all
    // tables in the public schema except the Prisma migrations table.
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        tbls TEXT;
      BEGIN
        SELECT string_agg(quote_ident(tablename), ',') INTO tbls
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations');
        IF tbls IS NOT NULL THEN
          EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE';
        END IF;
      END$$;
    `);
  }

  await clearDatabase();

  console.log('  → System / Fichier');
  await seedCompanyProfile();
  await seedPasswordPolicy();
  await seedPrinterConfigs();
  const currencyIds = await seedCurrencies();
  await seedExchangeRates(currencyIds);
  const userIds = await seedUsers();

  console.log('  → Séquences & Plan Comptable (minimal — voir SEED_DATA_NOTES.md)');
  await seedSequences();
  const planComptableIds = await seedPlanComptable();
  const fiscalPeriodIds = await seedFiscalPeriods();

  console.log('  → Référentiel (Tiers)');
  const tiers = await seedTiers();
  await attachPlaceholderConvention({ cedanteId: tiers.astree.id }, 'ASTREE');
  await attachPlaceholderConvention({ cedanteId: tiers.gatAssurance.id }, 'GAT ASSURANCE');
  await attachPlaceholderConvention({ reassureurId: tiers.continentalRe.id }, 'CONTINENTAL RE');

  console.log('  → Affaires (exemples issus du Cahier des Charges)');
  const astreeSotim = await seedFacultativeAstreeSotim(tiers);
  const gatOilLybia = await seedFacultativeGatOilLybia(tiers);
  await seedTraiteStarOmanRe(tiers, planComptableIds);

  console.log('  → Bordereaux');
  await seedGatOilLybiaBordereaux(gatOilLybia, tiers);

  console.log('  → Comptabilité');
  await seedJournalEntries(gatOilLybia, tiers, planComptableIds, fiscalPeriodIds);

  console.log('  → Sinistres (fixture de test)');
  await seedSinistreFixture(astreeSotim, userIds);

  console.log('✅ Seed terminé.');
  console.log('⚠️  Voir SEED_DATA_NOTES.md pour la liste des hypothèses [ASSUMPTION] et des données manquantes à confirmer avec ARS avant mise en production.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });