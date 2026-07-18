import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dashboard test data...');

  // 1. Create users
  const passwordHash = await bcrypt.hash('Password123!', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ars.tn' },
    update: {},
    create: {
      email: 'admin@ars.tn',
      passwordHash,
      nom: 'Admin',
      prenom: 'Super',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const daf = await prisma.user.upsert({
    where: { email: 'daf@ars.tn' },
    update: {},
    create: {
      email: 'daf@ars.tn',
      passwordHash,
      nom: 'Financier',
      prenom: 'Directeur',
      role: 'DAF',
      isActive: true,
    },
  });

  const irds = await prisma.user.upsert({
    where: { email: 'irds@ars.tn' },
    update: {},
    create: {
      email: 'irds@ars.tn',
      passwordHash,
      nom: 'Sinistres',
      prenom: 'Service',
      role: 'SERVICE_IRDS',
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // 2. Create sequences
  await prisma.sequence.upsert({
    where: { entityType: 'CEDANTE' },
    update: { lastValue: 5 },
    create: { entityType: 'CEDANTE', lastValue: 5, prefix: 'CED' },
  });

  await prisma.sequence.upsert({
    where: { entityType: 'REASSUREUR' },
    update: { lastValue: 5 },
    create: { entityType: 'REASSUREUR', lastValue: 5, prefix: 'REA' },
  });

  await prisma.sequence.upsert({
    where: { entityType: 'AFFAIRE' },
    update: { lastValue: 20 },
    create: { entityType: 'AFFAIRE', lastValue: 20, prefix: 'AFF' },
  });

  await prisma.sequence.upsert({
    where: { entityType: 'SINISTRE' },
    update: { lastValue: 15 },
    create: { entityType: 'SINISTRE', lastValue: 15, prefix: 'SIN' },
  });

  console.log('✅ Sequences created');

  // 3. Create Cédantes
  const cedantes = await Promise.all([
    prisma.cedante.upsert({
      where: { code: 'CED001' },
      update: {},
      create: {
        code: 'CED001',
        compteComptable: '41130001',
        isAccountLocked: true,
        raisonSociale: 'STAR Assurances',
        rne: 'B123456789',
        formeJuridique: 'SA',
        adresse: '123 Avenue Habib Bourguiba, Tunis',
        pays: 'Tunisie',
        capital: 50000000,
        isActive: true,
      },
    }),
    prisma.cedante.upsert({
      where: { code: 'CED002' },
      update: {},
      create: {
        code: 'CED002',
        compteComptable: '41130002',
        isAccountLocked: true,
        raisonSociale: 'COMAR Assurances',
        rne: 'B987654321',
        formeJuridique: 'SA',
        adresse: '45 Rue de la Liberté, Tunis',
        pays: 'Tunisie',
        capital: 40000000,
        isActive: true,
      },
    }),
    prisma.cedante.upsert({
      where: { code: 'CED003' },
      update: {},
      create: {
        code: 'CED003',
        compteComptable: '41130003',
        isAccountLocked: true,
        raisonSociale: 'GAT Assurances',
        rne: 'B456789123',
        formeJuridique: 'SA',
        adresse: '78 Avenue Mohamed V, Tunis',
        pays: 'Tunisie',
        capital: 35000000,
        isActive: true,
      },
    }),
    prisma.cedante.upsert({
      where: { code: 'CED004' },
      update: {},
      create: {
        code: 'CED004',
        compteComptable: '41130004',
        isAccountLocked: true,
        raisonSociale: 'LLOYD Tunisien',
        rne: 'B789123456',
        formeJuridique: 'SA',
        adresse: '12 Rue de Marseille, Tunis',
        pays: 'Tunisie',
        capital: 30000000,
        isActive: true,
      },
    }),
    prisma.cedante.upsert({
      where: { code: 'CED005' },
      update: {},
      create: {
        code: 'CED005',
        compteComptable: '41130005',
        isAccountLocked: true,
        raisonSociale: 'MAGHREBIA Assurances',
        rne: 'B321654987',
        formeJuridique: 'SA',
        adresse: '56 Avenue de Carthage, Tunis',
        pays: 'Tunisie',
        capital: 28000000,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Cédantes created');

  // 4. Create Réassureurs
  const reassureurs = await Promise.all([
    prisma.reassureur.upsert({
      where: { code: 'REA001' },
      update: {},
      create: {
        code: 'REA001',
        compteComptable: '40130001',
        isAccountLocked: true,
        raisonSociale: 'Munich Re',
        formeJuridique: 'AG',
        adresse: 'Königinstraße 107, Munich',
        pays: 'Allemagne',
        capital: 5000000000,
        isActive: true,
      },
    }),
    prisma.reassureur.upsert({
      where: { code: 'REA002' },
      update: {},
      create: {
        code: 'REA002',
        compteComptable: '40130002',
        isAccountLocked: true,
        raisonSociale: 'Swiss Re',
        formeJuridique: 'AG',
        adresse: 'Mythenquai 50/60, Zurich',
        pays: 'Suisse',
        capital: 4500000000,
        isActive: true,
      },
    }),
    prisma.reassureur.upsert({
      where: { code: 'REA003' },
      update: {},
      create: {
        code: 'REA003',
        compteComptable: '40130003',
        isAccountLocked: true,
        raisonSociale: 'SCOR SE',
        formeJuridique: 'SE',
        adresse: '5 Avenue Kléber, Paris',
        pays: 'France',
        capital: 3500000000,
        isActive: true,
      },
    }),
    prisma.reassureur.upsert({
      where: { code: 'REA004' },
      update: {},
      create: {
        code: 'REA004',
        compteComptable: '40130004',
        isAccountLocked: true,
        raisonSociale: 'Hannover Re',
        formeJuridique: 'SE',
        adresse: 'Karl-Wiechert-Allee 50, Hannover',
        pays: 'Allemagne',
        capital: 3000000000,
        isActive: true,
      },
    }),
    prisma.reassureur.upsert({
      where: { code: 'REA005' },
      update: {},
      create: {
        code: 'REA005',
        compteComptable: '40130005',
        isAccountLocked: true,
        raisonSociale: 'Tunis Re',
        formeJuridique: 'SA',
        adresse: 'Rue du Lac Windermere, Tunis',
        pays: 'Tunisie',
        capital: 150000000,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Réassureurs created');

  // 5. Create Assurés
  const assures = await Promise.all([
    prisma.assure.upsert({
      where: { code: 'ASS001' },
      update: {},
      create: {
        code: 'ASS001',
        raisonSociale: 'Société Tunisienne de Banque',
        rne: 'B111222333',
        formeJuridique: 'SA',
        adresse: 'Rue Hédi Nouira, Tunis',
        pays: 'Tunisie',
        capital: 200000000,
        isActive: true,
      },
    }),
    prisma.assure.upsert({
      where: { code: 'ASS002' },
      update: {},
      create: {
        code: 'ASS002',
        raisonSociale: 'Tunisie Telecom',
        rne: 'B444555666',
        formeJuridique: 'SA',
        adresse: 'Avenue Taieb Mhiri, Tunis',
        pays: 'Tunisie',
        capital: 300000000,
        isActive: true,
      },
    }),
    prisma.assure.upsert({
      where: { code: 'ASS003' },
      update: {},
      create: {
        code: 'ASS003',
        raisonSociale: 'Groupe Chimique Tunisien',
        rne: 'B777888999',
        formeJuridique: 'SA',
        adresse: 'Zone Industrielle, Sfax',
        pays: 'Tunisie',
        capital: 150000000,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Assurés created');

  // 6. Create Exchange Rates
  const today = new Date();
  const currencies = [
    { code: 'EUR', rate: 3.25 },
    { code: 'USD', rate: 3.10 },
    { code: 'GBP', rate: 3.85 },
    { code: 'CHF', rate: 3.45 },
  ];

  for (const curr of currencies) {
    const currency = await prisma.currency.upsert({
      where: { code: curr.code },
      update: {},
      create: { code: curr.code, label: curr.code, isActive: true },
    });

    await prisma.exchangeRate.upsert({
      where: {
        currencyCode_dateEffet: {
          currencyCode: curr.code,
          dateEffet: today,
        },
      },
      update: {},
      create: {
        currencyId: currency.id,
        currencyCode: curr.code,
        taux: curr.rate,
        dateEffet: today,
        source: 'BCT',
        isMonthly: false,
      },
    });
  }

  console.log('✅ Exchange rates created');

  // 7. Create Affaires (Facultatives)
  const affaires = [];
  for (let i = 1; i <= 20; i++) {
    const cedante = cedantes[i % cedantes.length];
    const assure = assures[i % assures.length];
    
    const affaire = await prisma.affaire.create({
      data: {
        numero: `AFF${String(i).padStart(4, '0')}`,
        statut: i <= 15 ? 'PLACEMENT_REALISE' : i <= 18 ? 'PREVISION' : 'EN_COTATION',
        type: 'FACULTATIVE',
        modePaiement: 'PAR_AFFAIRE',
        currency: 'TND',
        cedanteId: cedante.id,
        isActive: true,
      },
    });

    const prime100 = 50000 + Math.random() * 450000;
    const tauxCession = 0.5 + Math.random() * 0.4;
    const primeCedee = prime100 * tauxCession;
    const tauxCommCedante = 0.15 + Math.random() * 0.1;
    const commissionCedante = primeCedee * tauxCommCedante;

    await prisma.facultativeAffaire.create({
      data: {
        affaireId: affaire.id,
        reassuranceType: i % 2 === 0 ? 'PROPORTIONNEL' : 'NON_PROPORTIONNEL',
        assureId: assure.id,
        numeroPoliceCedante: `POL-${i}-2025`,
        dateEffet: new Date(2025, 0, 1 + i),
        dateEcheance: new Date(2025, 11, 31),
        modeRenouvellement: 'TACITE',
        paysAssure: 'Tunisie',
        branche: ['Incendie', 'Transport', 'Automobile', 'RC'][i % 4],
        produit: 'Risques Industriels',
        garantie: 'Tous Risques',
        prime100Pct: prime100,
        tauxPrime: 0.02,
        tauxCession: tauxCession,
        primeCedee: primeCedee,
        tauxCommissionCedante: tauxCommCedante,
        commissionCedante: commissionCedante,
      },
    });

    // Add reinsurer participations
    const numReassureurs = 2 + Math.floor(Math.random() * 2);
    const selectedReassureurs = reassureurs.slice(0, numReassureurs);
    const partPerReassureur = 1 / numReassureurs;

    for (let j = 0; j < selectedReassureurs.length; j++) {
      const reassureur = selectedReassureurs[j];
      const tauxCommArs = 0.05 + Math.random() * 0.05;
      const primeBrute = primeCedee * partPerReassureur;
      const commArs = primeBrute * tauxCommArs;

      await prisma.affaireReassureur.create({
        data: {
          affaireId: affaire.id,
          reassureurId: reassureur.id,
          partPct: partPerReassureur,
          isLeader: j === 0,
          commissionMode: 'CALCULABLE',
          tauxCommissionArs: tauxCommArs,
          primeBrute: primeBrute,
          commissionArs: commArs,
          commissionCedante: commissionCedante * partPerReassureur,
          primeNetteCedante: (primeCedee - commissionCedante) * partPerReassureur,
          primeNetteReassureur: (primeBrute - commArs) * partPerReassureur,
        },
      });
    }

    affaires.push(affaire);
  }

  console.log('✅ Affaires created');

  // 8. Create Sinistres
  for (let i = 1; i <= 15; i++) {
    const affaire = affaires[i % affaires.length];
    const montant = 10000 + Math.random() * 190000;
    const joursOuvert = Math.floor(Math.random() * 120);
    
    const statuts = ['DECLARE', 'EN_COURS_VALIDATION', 'VALIDE', 'DECLARE_REASSUREURS', 'EN_RECUPERATION'];
    const statut = statuts[i % statuts.length];

    await prisma.sinistre.create({
      data: {
        numero: `SIN${String(i).padStart(4, '0')}`,
        affaireId: affaire.id,
        statut: statut as any,
        numerPolice: `POL-${i}-2025`,
        periodeCouverture: '2025',
        dateDeclaration: new Date(Date.now() - joursOuvert * 24 * 60 * 60 * 1000),
        dateSurvenance: new Date(Date.now() - (joursOuvert + 5) * 24 * 60 * 60 * 1000),
        reglementExerciceN: montant * 0.6,
        cumulReglementAnterieurs: montant * 0.2,
        reserves: montant * 0.2,
        partReassureurs: montant * 0.7,
        sap: montant * 0.3,
        appelAuComptant: i % 5 === 0,
      },
    });
  }

  console.log('✅ Sinistres created');

  // 9. Create Encaissements
  for (let i = 0; i < 10; i++) {
    const affaire = affaires[i];
    const cedante = cedantes[i % cedantes.length];
    
    await prisma.encaissement.create({
      data: {
        reference: `ENC${String(i + 1).padStart(6, '0')}`,
        affaireId: affaire.id,
        partyType: 'CEDANTE',
        cedanteId: cedante.id,
        montant: 50000 + Math.random() * 150000,
        currency: 'TND',
        tauxRealisation: 1.0,
        montantTnd: 50000 + Math.random() * 150000,
        dateEncaissement: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        description: `Encaissement prime affaire ${affaire.numero}`,
      },
    });
  }

  console.log('✅ Encaissements created');

  // 10. Create Decaissements
  for (let i = 0; i < 8; i++) {
    const affaire = affaires[i];
    const reassureur = reassureurs[i % reassureurs.length];
    
    await prisma.decaissement.create({
      data: {
        reference: `DEC${String(i + 1).padStart(6, '0')}`,
        affaireId: affaire.id,
        partyType: 'REASSUREUR',
        reassureurCode: reassureur.code,
        montant: 30000 + Math.random() * 100000,
        currency: 'TND',
        tauxReglement: 1.0,
        montantTnd: 30000 + Math.random() * 100000,
        dateDecaissement: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        description: `Règlement réassureur ${reassureur.raisonSociale}`,
      },
    });
  }

  console.log('✅ Décaissements created');

  console.log('');
  console.log('🎉 Dashboard seed completed!');
  console.log('');
  console.log('📧 Test users:');
  console.log('   admin@ars.tn / Password123! (SUPER_ADMIN)');
  console.log('   daf@ars.tn / Password123! (DAF - Finance Dashboard)');
  console.log('   irds@ars.tn / Password123! (SERVICE_IRDS - Sinistres Dashboard)');
  console.log('');
  console.log('📊 Data created:');
  console.log(`   - ${cedantes.length} Cédantes`);
  console.log(`   - ${reassureurs.length} Réassureurs`);
  console.log(`   - ${assures.length} Assurés`);
  console.log(`   - ${affaires.length} Affaires`);
  console.log('   - 15 Sinistres');
  console.log('   - 10 Encaissements');
  console.log('   - 8 Décaissements');
  console.log('   - 4 Exchange Rates');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
