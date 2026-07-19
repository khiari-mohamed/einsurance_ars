import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    'Sinistre',
    'Bordereau',
    'SituationLine',
    'Situation',
    'Settlement',
    'JournalEntry',
    'WorkflowTask',
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

  await prisma.user.createMany({
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

  const document = await prisma.document.create({
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
      documentId: document.id,
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
        dateEffet: new Date('2024-01-15T00:00:00.000Z'),
        dateEcheance: new Date('2024-12-31T00:00:00.000Z'),
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
        dateEffet: new Date('2023-06-01T00:00:00.000Z'),
        dateEcheance: new Date('2025-05-31T00:00:00.000Z'),
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
        dateEffet: new Date('2022-01-01T00:00:00.000Z'),
        dateEcheance: new Date('2024-12-31T00:00:00.000Z'),
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

  console.log('✅ Seed completed successfully.');
  console.log('Seeded entities:');
  console.log('- 4 users');
  console.log('- 1 company profile');
  console.log('- 4 assures');
  console.log('- 3 cedantes');
  console.log('- 3 reassureurs');
  console.log('- 2 co-courtiers');
  console.log('- contacts, bank accounts, documents and code registry entries');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
