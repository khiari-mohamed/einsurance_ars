import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const currentYear = new Date().getFullYear();

function makeUtcDate(month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(currentYear, month - 1, day, hour, minute, second));
}

async function resetDatabase() {
  const tables = [
    'AuditLog',
    'DocumentLink',
    'DocumentVersion',
    'DocumentShare',
    'DocumentAccessLog',
    'DocumentChecklistItem',
    'DocumentChecklist',
    'Convention',
    'Contact',
    'BankAccount',
    'AffaireReassureur',
    'Affaire',
    'FacultativeAffaire',
    'TraiteAffaire',
    'SinistreParticipation',
    'SinistreEvent',
    'SinistreAudit',
    'Sinistre',
    'BordereauPayment',
    'BordereauLine',
    'Bordereau',
    'SituationLine',
    'Situation',
    'Settlement',
    'Encaissement',
    'Decaissement',
    'OrdrePaiement',
    'LettrageItem',
    'Lettrage',
    'BankMovement',
    'FxGainLoss',
    'JournalLine',
    'JournalEntry',
    'WorkflowTask',
    'BudgetTarget',
    'FiscalPeriod',
    'PlanComptable',
    'AuxiliaryAccount',
    'ExchangeRate',
    'Currency',
    'RefreshToken',
    'PasswordResetToken',
    'User',
    'CodeRegistry',
    'Sequence',
    'CompanyFreeField',
    'CompanyContact',
    'CompanyBankAccount',
    'CompanyProfile',
    'CoCourtier',
    'Reassureur',
    'Cedante',
    'Assure',
    'Document',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
  }
}

async function main() {
  console.log('🌱 Resetting database and seeding référentiel master data...');

  await resetDatabase();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const users = await prisma.user.createManyAndReturn({
    data: [
      {
        email: 'admin@ars.tn',
        passwordHash,
        nom: 'Admin',
        prenom: 'Super',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      {
        email: 'daf@ars.tn',
        passwordHash,
        nom: 'Financier',
        prenom: 'Directeur',
        role: 'DAF',
        isActive: true,
      },
      {
        email: 'irds@ars.tn',
        passwordHash,
        nom: 'Sinistres',
        prenom: 'Service',
        role: 'SERVICE_IRDS',
        isActive: true,
      },
      {
        email: 'com@ars.tn',
        passwordHash,
        nom: 'Commercial',
        prenom: 'Direction',
        role: 'DIRECTION_COMMERCIALE',
        isActive: true,
      },
    ],
  });

  const admin = users.find((user) => user.email === 'admin@ars.tn');
  const daf = users.find((user) => user.email === 'daf@ars.tn');

  if (!admin || !daf) {
    throw new Error('Unable to locate seeded admin or DAF user');
  }

  await prisma.sequence.createMany({
    data: [
      { entityType: 'ASSURE', lastValue: 5, prefix: 'CLI' },
      { entityType: 'CEDANTE', lastValue: 5, prefix: 'CAS' },
      { entityType: 'REASSUREUR', lastValue: 5, prefix: 'REA' },
      { entityType: 'COCOURTIER', lastValue: 5, prefix: 'CCO' },
      { entityType: 'AFFAIRE', lastValue: 5, prefix: 'AFF' },
      { entityType: 'SINISTRE', lastValue: 5, prefix: 'SIN' },
    ],
  });

  const company = await prisma.companyProfile.create({
    data: {
      raisonSociale: 'ARS Reinsurance',
      adresse: '12 Avenue de la République, Tunis',
      ville: 'Tunis',
      codePostal: '1002',
      pays: 'Tunisie',
      formeJuridique: 'SARL',
      capitalSocial: 50000000,
      rne: 'B123456789',
      objetSocial: 'Réassurance et gestion de risques',
      representantsLegaux: ['M. Ahmed Ben Ali'],
      matriculeFiscal: '12345678A',
      regimeFiscal: 'Réel',
      assujettieATVA: true,
      tauxTVA: 19,
      autresTaxes: 'TVA',
      contacts: {
        create: [
          { nom: 'Ben Ali', poste: 'Directeur Général', telephone: '71234567', email: 'contact@ars.tn' },
        ],
      },
      bankAccounts: {
        create: [
          { banque: 'Banque Internationale Arabe de Tunisie', agence: 'Centre Urbain', rib: '12345678901234567890', swift: 'BIATTNTT', currency: 'TND', isDefault: true },
        ],
      },
    },
  });

  await prisma.companyFreeField.createMany({
    data: [
      { companyId: company.id, label: 'Secteur', valeur: 'Assurance', ordre: 1 },
      { companyId: company.id, label: 'Statut', valeur: 'Actif', ordre: 2 },
    ],
  });

  const assures = await prisma.assure.createManyAndReturn({
    data: [
      {
        code: 'CLI-0001',
        raisonSociale: 'Société Tunisienne de Banque',
        rne: 'B111222333',
        formeJuridique: 'SA',
        adresse: 'Rue Hédi Nouira, Tunis',
        pays: 'Tunisie',
        capital: 200000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
      {
        code: 'CLI-0002',
        raisonSociale: 'Tunisie Telecom',
        rne: 'B444555666',
        formeJuridique: 'SA',
        adresse: 'Avenue Taieb Mhiri, Tunis',
        pays: 'Tunisie',
        capital: 300000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
      {
        code: 'CLI-0003',
        raisonSociale: 'Groupe Chimique Tunisien',
        rne: 'B777888999',
        formeJuridique: 'SA',
        adresse: 'Zone Industrielle, Sfax',
        pays: 'Tunisie',
        capital: 150000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
      {
        code: 'CLI-0004',
        raisonSociale: 'Société de Production de l’Électricité',
        rne: 'B999000111',
        formeJuridique: 'SARL',
        adresse: 'Avenue de la Liberté, Sousse',
        pays: 'Tunisie',
        capital: 250000000,
        deviseParDefaut: 'TND',
        isActive: false,
      },
    ],
  });

  for (const assure of assures) {
    await prisma.contact.createMany({
      data: [
        {
          assureId: assure.id,
          nom: `Contact ${assure.code}`,
          prenom: 'Principal',
          poste: 'Responsable',
          telephoneFixe: '71000001',
          telephoneMobile: '20000001',
          email: `${assure.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.tn`,
        },
      ],
    });
  }

  const clientDocument = await prisma.document.create({
    data: {
      nom: 'Carte d’identité client',
      originalName: 'carte-client.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 204800,
      filePath: '/uploads/sample-client-document.pdf',
      documentType: 'CONTRAT',
      statut: 'RECU',
      isLatestVersion: true,
      versionNumber: 1,
    },
  });

  await prisma.documentLink.create({
    data: {
      documentId: clientDocument.id,
      entityType: 'ASSURE',
      assureId: assures[0].id,
    },
  });

  const cedantes = await prisma.cedante.createManyAndReturn({
    data: [
      {
        code: 'CAS-0001',
        compteComptable: '40121400',
        isAccountLocked: true,
        raisonSociale: 'BIAT Assurances',
        rne: 'B123456780',
        identifiantUnique: '1234567A',
        resident: true,
        formeJuridique: 'SA',
        adresse: 'Avenue de Paris, Tunis',
        pays: 'Tunisie',
        capital: 120000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
      {
        code: 'CAS-0002',
        compteComptable: '40124000',
        isAccountLocked: true,
        raisonSociale: 'STAR Assurances',
        rne: 'B223456781',
        identifiantUnique: '2234567B',
        resident: true,
        formeJuridique: 'SA',
        adresse: 'Avenue Habib Bourguiba, Tunis',
        pays: 'Tunisie',
        capital: 180000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
      {
        code: 'CAS-0003',
        compteComptable: '40127000',
        isAccountLocked: true,
        raisonSociale: 'ASTREE Ré',
        rne: 'B323456782',
        identifiantUnique: '3234567C',
        resident: true,
        formeJuridique: 'SA',
        adresse: 'Rue de la Paix, Tunis',
        pays: 'Tunisie',
        capital: 90000000,
        deviseParDefaut: 'TND',
        isActive: false,
      },
    ],
  });

  for (const cedante of cedantes) {
    await prisma.contact.createMany({
      data: [
        {
          cedanteId: cedante.id,
          nom: `Contact ${cedante.code}`,
          prenom: 'Principal',
          poste: 'Responsable',
          telephoneFixe: '71000010',
          telephoneMobile: '20000010',
          email: `${cedante.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.tn`,
        },
      ],
    });
    await prisma.bankAccount.createMany({
      data: [
        {
          cedanteId: cedante.id,
          banque: 'Banque de Tunisie',
          agence: 'Centre',
          rib: `123456789${cedante.code.length}`,
          iban: `TN591000${cedante.code.length}000000000`,
          swift: 'BCTNTNTT',
          currency: 'TND',
          isDefault: true,
        },
      ],
    });
  }

  const reassureurs = await prisma.reassureur.createManyAndReturn({
    data: [
      {
        code: 'REA-0001',
        compteComptable: '40130000',
        isAccountLocked: true,
        raisonSociale: 'Munich Re',
        rne: 'D100000001',
        identifiantUnique: '4234567D',
        resident: false,
        formeJuridique: 'AG',
        adresse: 'Königinstraße 107, Munich',
        pays: 'Allemagne',
        capital: 5000000000,
        deviseParDefaut: 'EUR',
        isActive: true,
      },
      {
        code: 'REA-0002',
        compteComptable: '40130001',
        isAccountLocked: true,
        raisonSociale: 'Swiss Re',
        rne: 'D200000002',
        resident: false,
        formeJuridique: 'AG',
        adresse: 'Mythenquai 50/60, Zurich',
        pays: 'Suisse',
        capital: 4500000000,
        deviseParDefaut: 'CHF',
        isActive: true,
      },
      {
        code: 'REA-0003',
        compteComptable: '40130002',
        isAccountLocked: true,
        raisonSociale: 'Tunis Re',
        identifiantUnique: '5234567E',
        resident: true,
        formeJuridique: 'SA',
        adresse: 'Rue du Lac Windermere, Tunis',
        pays: 'Tunisie',
        capital: 150000000,
        deviseParDefaut: 'TND',
        isActive: false,
      },
    ],
  });

  for (const reassureur of reassureurs) {
    await prisma.contact.createMany({
      data: [
        {
          reassureurId: reassureur.id,
          nom: `Contact ${reassureur.code}`,
          prenom: 'Principal',
          poste: 'Responsable',
          telephoneFixe: '71000020',
          telephoneMobile: '20000020',
          email: `${reassureur.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.tn`,
        },
      ],
    });
    await prisma.bankAccount.createMany({
      data: [
        {
          reassureurId: reassureur.id,
          banque: 'BNP Paribas',
          agence: 'Paris',
          rib: `987654321${reassureur.code.length}`,
          iban: `FR761000${reassureur.code.length}000000000`,
          swift: 'BNPAFRPP',
          currency: 'EUR',
          isDefault: true,
        },
      ],
    });
  }

  const coCourtiers = await prisma.coCourtier.createManyAndReturn({
    data: [
      {
        code: 'CCO-0001',
        compteComptable: '40130003',
        isAccountLocked: true,
        raisonSociale: 'Aon Reinsurance Brokers',
        resident: false,
        formeJuridique: 'SARL',
        adresse: '20 Avenue des Champs, Paris',
        pays: 'France',
        capital: 30000000,
        deviseParDefaut: 'EUR',
        isActive: true,
      },
      {
        code: 'CCO-0002',
        compteComptable: '40130004',
        isAccountLocked: true,
        raisonSociale: 'Atlas Brokers',
        identifiantUnique: '6234567F',
        resident: true,
        formeJuridique: 'SARL',
        adresse: 'Rue de l’Indépendance, Tunis',
        pays: 'Tunisie',
        capital: 12000000,
        deviseParDefaut: 'TND',
        isActive: true,
      },
    ],
  });

  const affaires = await prisma.affaire.createManyAndReturn({
    data: [
      {
        numero: 'AFF-0001',
        statut: 'EN_COTATION',
        type: 'FACULTATIVE',
        cedanteId: cedantes[0].id,
        modePaiement: 'PAR_AFFAIRE',
        currency: 'TND',
      },
      {
        numero: 'AFF-0002',
        statut: 'PREVISION',
        type: 'TRAITE',
        cedanteId: cedantes[1].id,
        modePaiement: 'PAR_SITUATION',
        currency: 'TND',
      },
      {
        numero: 'AFF-0003',
        statut: 'PLACEMENT_REALISE',
        type: 'FACULTATIVE',
        cedanteId: cedantes[0].id,
        modePaiement: 'PAR_AFFAIRE',
        currency: 'TND',
      },
    ],
  });

  await prisma.affaireReassureur.createMany({
    data: [
      {
        affaireId: affaires[0].id,
        reassureurId: reassureurs[0].id,
        partPct: 100,
        isLeader: true,
        commissionMode: 'CALCULABLE',
        tauxCommissionArs: 12,
      },
      {
        affaireId: affaires[1].id,
        reassureurId: reassureurs[1].id,
        partPct: 100,
        isLeader: true,
        commissionMode: 'CALCULABLE',
        tauxCommissionArs: 8,
      },
      {
        affaireId: affaires[2].id,
        reassureurId: reassureurs[0].id,
        partPct: 100,
        isLeader: true,
        commissionMode: 'CALCULABLE',
        tauxCommissionArs: 10,
      },
    ],
  });

  await prisma.facultativeAffaire.createMany({
    data: [
      {
        affaireId: affaires[0].id,
        reassuranceType: 'PROPORTIONNEL',
        assureId: assures[0].id,
        numeroPoliceCedante: 'POL-001',
        dateEffet: makeUtcDate(1, 15),
        dateEcheance: makeUtcDate(12, 31),
        modeRenouvellement: 'TACITE',
        paysAssure: 'Tunisie',
        branche: 'Incendie',
        produit: 'RC',
        garantie: 'Responsabilité civile',
        prime100Pct: 1200000,
        tauxPrime: 8,
        tauxCession: 60,
        primeCedee: 720000,
        tauxCommissionCedante: 5,
        commissionCedante: 36000,
      },
      {
        affaireId: affaires[2].id,
        reassuranceType: 'NON_PROPORTIONNEL',
        assureId: assures[0].id,
        numeroPoliceCedante: 'POL-003',
        dateEffet: makeUtcDate(6, 1),
        dateEcheance: makeUtcDate(5, 31),
        modeRenouvellement: 'NEGOCIATION',
        paysAssure: 'Tunisie',
        branche: 'Transport',
        produit: 'Marine',
        garantie: 'Cargo',
        prime100Pct: 1800000,
        tauxPrime: 10,
        tauxCession: 70,
        primeCedee: 1260000,
        tauxCommissionCedante: 7,
        commissionCedante: 88200,
      },
    ],
  });

  await prisma.traiteAffaire.createMany({
    data: [
      {
        affaireId: affaires[1].id,
        referenceTraite: 'TRT-001',
        reassuranceType: 'PROPORTIONNEL',
        formeCouverture: 'QUOTA_PART',
        dateEffet: makeUtcDate(1, 1),
        dateEcheance: makeUtcDate(12, 31),
        modeRenouvellement: 'TACITE',
        zoneGeographique: 'Tunisie',
        branche: 'Catnat',
        produit: 'Traité',
        garantie: 'Catastrophes',
        periodicite: 'TRIMESTRIELLE',
        primePrevisionnelle: 3500000,
        pmd: 250000,
        tauxCommissionCedante: 4,
        commissionLiquidationArs: 140000,
        seuilNotification: 100000,
      },
    ],
  });

  for (const coCourtier of coCourtiers) {
    await prisma.contact.createMany({
      data: [
        {
          coCourtId: coCourtier.id,
          nom: `Contact ${coCourtier.code}`,
          prenom: 'Principal',
          poste: 'Responsable',
          telephoneFixe: '71000030',
          telephoneMobile: '20000030',
          email: `${coCourtier.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.tn`,
        },
      ],
    });
    await prisma.bankAccount.createMany({
      data: [
        {
          coCourtId: coCourtier.id,
          banque: 'Banque du Groupe',
          agence: 'Paris',
          rib: `456789012${coCourtier.code.length}`,
          iban: `DE021005${coCourtier.code.length}00000000`,
          swift: 'DEUTDEFF',
          currency: 'EUR',
          isDefault: true,
        },
      ],
    });
  }

  await prisma.codeRegistry.createMany({
    data: [
      { code: 'CLI-0001', entityType: 'ASSURE', entityId: assures[0].id },
      { code: 'CLI-0002', entityType: 'ASSURE', entityId: assures[1].id },
      { code: 'CLI-0003', entityType: 'ASSURE', entityId: assures[2].id },
      { code: 'CLI-0004', entityType: 'ASSURE', entityId: assures[3].id },
      { code: 'CAS-0001', entityType: 'CEDANTE', entityId: cedantes[0].id },
      { code: 'CAS-0002', entityType: 'CEDANTE', entityId: cedantes[1].id },
      { code: 'CAS-0003', entityType: 'CEDANTE', entityId: cedantes[2].id },
      { code: 'REA-0001', entityType: 'REASSUREUR', entityId: reassureurs[0].id },
      { code: 'REA-0002', entityType: 'REASSUREUR', entityId: reassureurs[1].id },
      { code: 'REA-0003', entityType: 'REASSUREUR', entityId: reassureurs[2].id },
      { code: 'CCO-0001', entityType: 'CO_COURTIER', entityId: coCourtiers[0].id },
      { code: 'CCO-0002', entityType: 'CO_COURTIER', entityId: coCourtiers[1].id },
    ],
  });

  const tndCurrency = await prisma.currency.upsert({
    where: { code: 'TND' },
    update: {},
    create: { code: 'TND', label: 'Dinar Tunisien' },
  });

  const usdCurrency = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', label: 'Dollar US' },
  });

  const eurCurrency = await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', label: 'Euro' },
  });

  await prisma.exchangeRate.upsert({
    where: { currencyCode_dateEffet: { currencyCode: 'USD', dateEffet: makeUtcDate(1, 1) } },
    update: {},
    create: {
      currencyId: usdCurrency.id,
      currencyCode: usdCurrency.code,
      taux: 3.18,
      dateEffet: makeUtcDate(1, 1),
      source: 'BCT',
      isMonthly: false,
    },
  });

  await prisma.exchangeRate.upsert({
    where: { currencyCode_dateEffet: { currencyCode: 'EUR', dateEffet: makeUtcDate(1, 1) } },
    update: {},
    create: {
      currencyId: eurCurrency.id,
      currencyCode: eurCurrency.code,
      taux: 3.35,
      dateEffet: makeUtcDate(1, 1),
      source: 'BCT',
      isMonthly: false,
    },
  });

  await prisma.budgetTarget.createMany({
    data: [
      { annee: currentYear, mois: 1, cedanteId: cedantes[0].id, targetCA: 1200000, actualCA: 1185000, variancePct: -1.25 },
      { annee: currentYear, mois: 1, reassureurCode: 'REA-0001', targetCA: 900000, actualCA: 925000, variancePct: 2.78 },
    ],
  });

  const fiscalPeriod = await prisma.fiscalPeriod.create({
    data: {
      annee: currentYear,
      mois: 1,
      dateDebut: makeUtcDate(1, 1),
      dateFin: makeUtcDate(1, 31, 23, 59, 59),
      isClosed: false,
    },
  });

  await prisma.planComptable.createMany({
    data: [
      { compte: '41130000', libelle: 'Cédantes', type: 'DEBIT_NORMAL', classe: '4' },
      { compte: '40130000', libelle: 'Réassureurs', type: 'CREDIT_NORMAL', classe: '4' },
      { compte: '53200000', libelle: 'Banque', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '70510000', libelle: 'Commissions ARS', type: 'CREDIT_NORMAL', classe: '7' },
    ],
  });

  const planComptable = await prisma.planComptable.findFirst({ where: { compte: '41130000' } });

  const settlement = await prisma.settlement.create({
    data: {
      reference: 'SET-0001',
      mode: 'PAR_AFFAIRE',
      affaireId: affaires[0].id,
      montant: 600000,
      currency: 'TND',
      tauxRealisation: 1,
      tauxReglement: 1,
      montantTnd: 600000,
      dateSettlement: makeUtcDate(1, 20),
    },
  });

  const encaissement = await prisma.encaissement.create({
    data: {
      reference: 'ENC-0001',
      affaireId: affaires[0].id,
      partyType: 'CEDANTE',
      cedanteId: cedantes[0].id,
      montant: 600000,
      currency: 'TND',
      tauxRealisation: 1,
      montantTnd: 600000,
      isValidated: true,
      validatedAt: makeUtcDate(1, 20),
      dateEncaissement: makeUtcDate(1, 20),
      description: 'Prime facultative encaissée',
      settlementId: settlement.id,
    },
  });

  const decaissement = await prisma.decaissement.create({
    data: {
      reference: 'DEC-0001',
      affaireId: affaires[0].id,
      partyType: 'REASSUREUR',
      reassureurCode: 'REA-0001',
      montant: 300000,
      currency: 'TND',
      tauxReglement: 1,
      montantTnd: 300000,
      statut: 'APPROUVE',
      approvedAt: makeUtcDate(1, 22),
      dateDecaissement: makeUtcDate(1, 22),
      description: 'Commission au réassureur',
      settlementId: settlement.id,
    },
  });

  const ordrePaiement = await prisma.ordrePaiement.create({
    data: {
      reference: 'OP-0001',
      statut: 'VALIDE',
      beneficiaire: 'Munich Re',
      montant: 300000,
      currency: 'TND',
      referenceAffaire: affaires[0].numero,
      dateExecution: makeUtcDate(1, 23),
      signataires: ['Admin'],
      dateValidation: makeUtcDate(1, 23),
      validatedByUserId: admin.id,
    },
  });

  await prisma.decaissement.update({
    where: { id: decaissement.id },
    data: { ordrePaiementId: ordrePaiement.id },
  });

  const treatyAffaire = await prisma.traiteAffaire.findFirst({
    where: { affaireId: affaires[1].id },
  });

  if (!treatyAffaire) {
    throw new Error('Unable to find treaty data for the seeded situation');
  }

  const situation = await prisma.situation.create({
    data: {
      reference: 'SIT-0001',
      cedanteId: cedantes[0].id,
      traiteId: treatyAffaire.id,
      dateDebut: makeUtcDate(1, 1),
      dateFin: makeUtcDate(3, 31, 23, 59, 59),
      periodicite: 'TRIMESTRIELLE',
      totalDebit: 600000,
      totalCredit: 300000,
      soldeNet: 300000,
      soldeDirection: 'CEDANTE_DOIT',
      currency: 'TND',
    },
  });

  await prisma.situationLine.create({
    data: {
      situationId: situation.id,
      affaireId: affaires[0].id,
      debit: 600000,
      credit: 300000,
      solde: 300000,
      description: 'Netting de la période',
    },
  });

  const bordereau = await prisma.bordereau.create({
    data: {
      numero: 'BDR-0001',
      type: 'SITUATION_TRAITE',
      statut: 'VALIDE',
      affaireId: affaires[1].id,
      situationId: situation.id,
      cedanteId: cedantes[0].id,
      currency: 'TND',
      montantTotal: 300000,
      montantEnLettres: 'TROIS CENT MILLE DINARS',
      dateLimitePaiement: makeUtcDate(4, 15),
      dateValidation: makeUtcDate(3, 15),
      createdByUserId: admin.id,
      validatedByUserId: admin.id,
      montantRegle: 0,
    },
  });

  await prisma.bordereauLine.create({
    data: {
      bordereauId: bordereau.id,
      libelle: 'Situation de traite',
      prime100: 600000,
      primeBrute: 600000,
      commissionCedante: 30000,
      primeNette: 570000,
      currency: 'TND',
      ordre: 1,
    },
  });

  await prisma.bordereauPayment.create({
    data: {
      bordereauId: bordereau.id,
      montant: 300000,
      modePaiement: 'VIREMENT',
      datePaiement: makeUtcDate(3, 20),
      referenceBancaire: 'REF-001',
      notes: 'Paiement partiel',
      recordedByUserId: admin.id,
    },
  });

  await prisma.document.create({
    data: {
      nom: 'Document de démonstration',
      originalName: 'demo-document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 102400,
      filePath: '/uploads/demo-document.pdf',
      documentType: 'CONTRAT',
      statut: 'RECU',
      isLatestVersion: true,
      versionNumber: 1,
    },
  });

  const conventionDocument = await prisma.document.create({
    data: {
      nom: 'Convention signée',
      originalName: 'convention.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 204800,
      filePath: '/uploads/convention.pdf',
      documentType: 'CONVENTION',
      statut: 'RECU',
      isLatestVersion: true,
      versionNumber: 1,
    },
  });

  await prisma.documentLink.create({
    data: {
      documentId: conventionDocument.id,
      entityType: 'AFFAIRE',
      affaireId: affaires[0].id,
    },
  });

  await prisma.documentChecklist.create({
    data: {
      affaireId: affaires[0].id,
      completionPct: 100,
      items: {
        create: [
          { documentType: 'CONTRAT', libelle: 'Police', isMandatory: true, statut: 'RECU', ordre: 1 },
          { documentType: 'CONVENTION', libelle: 'Convention signée', isMandatory: true, statut: 'RECU', ordre: 2 },
        ],
      },
    },
  });

  await prisma.workflowTask.create({
    data: {
      type: 'VALIDATION_SINISTRE',
      statut: 'EN_ATTENTE',
      affaireId: affaires[0].id,
      assignedToId: admin.id,
      createdById: admin.id,
      description: 'Valider le dossier de réassurance',
      dueDate: makeUtcDate(2, 15),
    },
  });

  await prisma.journalEntry.create({
    data: {
      numero: 'JE-0001',
      statut: 'VALIDE',
      type: 'ENCAISSEMENT_PRIME_CEDEE',
      affaireId: affaires[0].id,
      fiscalPeriodId: fiscalPeriod.id,
      codeJournal: 'VTEEXP',
      pieceComptable: 'PC001',
      validatedAt: makeUtcDate(1, 21),
      validatedBy: admin.id,
      description: 'Pièce de validation de la prime',
      currency: 'TND',
      lines: {
        create: [
          {
            planComptableId: planComptable!.id,
            cedanteId: cedantes[0].id,
            debit: 600000,
            credit: 0,
            currency: 'TND',
            libelle: 'Prime encaissée',
            ordre: 1,
          },
          {
            planComptableId: planComptable!.id,
            reassureurId: reassureurs[0].id,
            debit: 0,
            credit: 600000,
            currency: 'TND',
            libelle: 'Réassureur crédité',
            ordre: 2,
          },
        ],
      },
    },
  });

  await prisma.sinistre.create({
    data: {
      numero: 'SIN-0001',
      affaireId: affaires[0].id,
      statut: 'DECLARE',
      numerPolice: 'POL-001',
      periodeCouverture: `${currentYear}-01`,
      dateSurvenance: makeUtcDate(1, 10),
      reglementExerciceN: 150000,
      cumulReglementAnterieurs: 0,
      reserves: 50000,
      partReassureurs: 75000,
      appelAuComptant: true,
      recoveryMethod: 'COMPENSATION',
      events: {
        create: [
          {
            actorLabel: 'Commercial',
            action: 'Déclaration reçue cédante',
            note: 'Sinistre déclaré par la cédante',
          },
        ],
      },
      participations: {
        create: [
          {
            reassureurCode: 'REA-0001',
            partPct: 100,
            montantPart: 75000,
            isNotified: true,
            notifiedAt: makeUtcDate(1, 12),
          },
        ],
      },
    },
  });

  console.log('✅ Seed completed successfully.');
  console.log('Seeded entities:');
  console.log('- 4 users');
  console.log('- 1 company profile');
  console.log('- 4 assures');
  console.log('- 3 cedantes');
  console.log('- 3 reassureurs');
  console.log('- 2 co-courtiers');
  console.log('- master data, finance records, workflow tasks, claims and accounting entries');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
