import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

export async function seedDatabase(dataSource: DataSource) {
  console.log('🌱 Starting database seeding...');
  console.log('⚠️  Note: Only seeding core entities (Users, Assurés, Cédantes, Réassureurs, Affaires)');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await dataSource.query('TRUNCATE TABLE affaires, cedante_contacts, reassureurs, cedantes, assures, users RESTART IDENTITY CASCADE');
  console.log('✅ Data cleared');

  // 1. USERS
  const userRepo = dataSource.getRepository('User');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await userRepo.save([
    {
      email: 'admin@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMINISTRATEUR',
      isActive: true,
    },
    {
      email: 'directeur@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Mohamed',
      lastName: 'Ben Ali',
      role: 'DIRECTEUR_GENERAL',
      isActive: true,
    },
    {
      email: 'commercial@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Fatma',
      lastName: 'Trabelsi',
      role: 'DIRECTEUR_COMMERCIAL',
      isActive: true,
    },
    {
      email: 'charge1@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Ahmed',
      lastName: 'Gharbi',
      role: 'CHARGE_DE_DOSSIER',
      isActive: true,
    },
    {
      email: 'charge2@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Leila',
      lastName: 'Mansour',
      role: 'CHARGE_DE_DOSSIER',
      isActive: true,
    },
    {
      email: 'sinistres@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Karim',
      lastName: 'Bouazizi',
      role: 'TECHNICIEN_SINISTRES',
      isActive: true,
    },
    {
      email: 'finance@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Sonia',
      lastName: 'Hamdi',
      role: 'AGENT_FINANCIER',
      isActive: true,
    },
    {
      email: 'comptable@arstunisie.tn',
      password: hashedPassword,
      firstName: 'Nabil',
      lastName: 'Jebali',
      role: 'COMPTABLE',
      isActive: true,
    },
  ]);

  console.log('✅ Users created');

  // 2. ASSURÉS (Clients)
  const assureRepo = dataSource.getRepository('Assure');
  const assures = await assureRepo.save([
    {
      code: 'ASS001',
      raisonSociale: 'Société Tunisienne de Transport Maritime',
      formeJuridique: 'SA',
      matriculeFiscale: '1234567ABC',
      adresse: 'Avenue Habib Bourguiba, Tunis',
      ville: 'Tunis',
      codePostal: '1000',
      pays: 'Tunisie',
      telephone: '+216 71 123 456',
      email: 'contact@sttm.tn',
      auxiliaireComptable: '411001',
      isActive: true,
    },
    {
      code: 'ASS002',
      raisonSociale: 'Groupe Industriel Tunisien',
      formeJuridique: 'SA',
      matriculeFiscale: '2345678DEF',
      adresse: 'Zone Industrielle, Sfax',
      ville: 'Sfax',
      codePostal: '3000',
      pays: 'Tunisie',
      telephone: '+216 74 234 567',
      email: 'info@git.tn',
      auxiliaireComptable: '411002',
      isActive: true,
    },
    {
      code: 'ASS003',
      raisonSociale: 'Hôtel Le Palace Sousse',
      formeJuridique: 'SARL',
      matriculeFiscale: '3456789GHI',
      adresse: 'Boulevard 14 Janvier, Sousse',
      ville: 'Sousse',
      codePostal: '4000',
      pays: 'Tunisie',
      telephone: '+216 73 345 678',
      email: 'reservation@lepalace.tn',
      auxiliaireComptable: '411003',
      isActive: true,
    },
  ]);

  console.log('✅ Assurés created');

  // 3. CÉDANTES (Insurance Companies)
  const cedanteRepo = dataSource.getRepository('Cedante');
  const cedantes = await cedanteRepo.save([
    {
      code: 'CED001',
      raisonSociale: 'STAR Assurances',
      formeJuridique: 'SA',
      matriculeFiscale: '5678901JKL',
      adresse: 'Rue de la Liberté, Tunis',
      ville: 'Tunis',
      codePostal: '1002',
      pays: 'Tunisie',
      telephone: '+216 71 567 890',
      email: 'contact@star.tn',
      auxiliaireComptable: '411101',
      isActive: true,
    },
    {
      code: 'CED002',
      raisonSociale: 'Assurances Salim',
      formeJuridique: 'SA',
      matriculeFiscale: '6789012MNO',
      adresse: 'Avenue Mohamed V, Tunis',
      ville: 'Tunis',
      codePostal: '1001',
      pays: 'Tunisie',
      telephone: '+216 71 678 901',
      email: 'info@salim.tn',
      auxiliaireComptable: '411102',
      isActive: true,
    },
    {
      code: 'CED003',
      raisonSociale: 'GAT Assurances',
      formeJuridique: 'SA',
      matriculeFiscale: '7890123PQR',
      adresse: 'Rue de Marseille, Tunis',
      ville: 'Tunis',
      codePostal: '1000',
      pays: 'Tunisie',
      telephone: '+216 71 789 012',
      email: 'contact@gat.tn',
      auxiliaireComptable: '411103',
      isActive: true,
    },
  ]);

  console.log('✅ Cédantes created');

  // 4. RÉASSUREURS (Reinsurers)
  const reassureurRepo = dataSource.getRepository('Reassureur');
  const reassureurs = await reassureurRepo.save([
    {
      code: 'REA001',
      raisonSociale: 'Tunis Re',
      formeJuridique: 'SA',
      matriculeFiscale: '8901234STU',
      adresse: 'Rue du Lac, Les Berges du Lac',
      ville: 'Tunis',
      codePostal: '1053',
      pays: 'Tunisie',
      telephone: '+216 71 890 123',
      email: 'contact@tunisre.tn',
      auxiliaireComptable: '401001',
      isActive: true,
    },
    {
      code: 'REA002',
      raisonSociale: 'Africa Re',
      formeJuridique: 'SA',
      matriculeFiscale: 'AFR123456',
      adresse: 'Plot 1679, Karimu Kotun Street, Victoria Island',
      ville: 'Lagos',
      codePostal: '101241',
      pays: 'Nigeria',
      telephone: '+234 1 461 6820',
      email: 'info@africa-re.com',
      auxiliaireComptable: '401002',
      isActive: true,
    },
    {
      code: 'REA003',
      raisonSociale: 'SCOR SE',
      formeJuridique: 'SE',
      matriculeFiscale: 'SCR789012',
      adresse: '5 Avenue Kléber',
      ville: 'Paris',
      codePostal: '75116',
      pays: 'France',
      telephone: '+33 1 58 44 70 00',
      email: 'contact@scor.com',
      auxiliaireComptable: '401003',
      isActive: true,
    },
    {
      code: 'REA004',
      raisonSociale: 'Munich Re',
      formeJuridique: 'AG',
      matriculeFiscale: 'MUN345678',
      adresse: 'Königinstraße 107',
      ville: 'Munich',
      codePostal: '80802',
      pays: 'Germany',
      telephone: '+49 89 3891 0',
      email: 'info@munichre.com',
      auxiliaireComptable: '401004',
      isActive: true,
    },
    {
      code: 'REA005',
      raisonSociale: 'Swiss Re',
      formeJuridique: 'AG',
      matriculeFiscale: 'SWI901234',
      adresse: 'Mythenquai 50/60',
      ville: 'Zurich',
      codePostal: '8022',
      pays: 'Switzerland',
      telephone: '+41 43 285 2121',
      email: 'contact@swissre.com',
      auxiliaireComptable: '401005',
      isActive: true,
    },
  ]);

  console.log('✅ Réassureurs created');

  // 5. CONTACTS for Cédantes
  const contactRepo = dataSource.getRepository('CedanteContact');
  await contactRepo.save([
    {
      cedanteId: cedantes[0].id,
      nom: 'Amri',
      prenom: 'Hichem',
      fonction: 'Directeur Technique',
      telephone: '+216 71 567 891',
      email: 'h.amri@star.tn',
      principal: true,
    },
    {
      cedanteId: cedantes[1].id,
      nom: 'Kacem',
      prenom: 'Samia',
      fonction: 'Responsable Réassurance',
      telephone: '+216 71 678 902',
      email: 's.kacem@salim.tn',
      principal: true,
    },
    {
      cedanteId: cedantes[2].id,
      nom: 'Dridi',
      prenom: 'Tarek',
      fonction: 'Chef Service Réassurance',
      telephone: '+216 71 789 013',
      email: 't.dridi@gat.tn',
      principal: true,
    },
  ]);

  console.log('✅ Contacts created');

  // 6. AFFAIRES
  const affaireRepo = dataSource.getRepository('Affaire');
  const affaires = await affaireRepo.save([
    {
      numeroAffaire: 'FAC-2024-001',
      status: 'placement_realise',
      type: 'proportionnel',
      assure: assures[0],
      cedante: cedantes[0],
      numeroPolice: 'POL-2024-001',
      dateEffet: new Date('2024-01-01'),
      dateEcheance: new Date('2024-12-31'),
      branche: 'Transport Maritime',
      garantie: 'Corps de Navire',
      capitalAssure100: 5000000,
      prime100: 125000,
      tauxCession: 80,
      primeCedee: 100000,
      commissionCedante: 20,
      montantCommissionCedante: 20000,
      commissionARS: 2.5,
      montantCommissionARS: 2500,
      devise: 'EUR',
      notes: 'Navire cargo 15000 tonnes, construction 2020',
    },
    {
      numeroAffaire: 'FAC-2024-002',
      status: 'placement_realise',
      type: 'proportionnel',
      assure: assures[1],
      cedante: cedantes[1],
      numeroPolice: 'POL-2024-002',
      dateEffet: new Date('2024-02-01'),
      dateEcheance: new Date('2025-01-31'),
      branche: 'Incendie',
      garantie: 'Tous Risques Industriels',
      capitalAssure100: 8000000,
      prime100: 160000,
      tauxCession: 75,
      primeCedee: 120000,
      commissionCedante: 22.5,
      montantCommissionCedante: 27000,
      commissionARS: 3,
      montantCommissionARS: 3600,
      devise: 'TND',
      notes: 'Usine textile, risque incendie et explosion',
    },
    {
      numeroAffaire: 'FAC-2024-003',
      status: 'cotation',
      type: 'proportionnel',
      assure: assures[2],
      cedante: cedantes[2],
      numeroPolice: 'POL-2024-003',
      dateEffet: new Date('2024-06-01'),
      dateEcheance: new Date('2025-05-31'),
      branche: 'Responsabilité Civile',
      garantie: 'RC Hôtelière',
      capitalAssure100: 3000000,
      prime100: 75000,
      tauxCession: 60,
      primeCedee: 45000,
      commissionCedante: 25,
      montantCommissionCedante: 11250,
      commissionARS: 2,
      montantCommissionARS: 900,
      devise: 'EUR',
      notes: 'Hôtel 5 étoiles, 200 chambres',
    },
  ]);

  console.log('✅ Affaires created');

  console.log('🎉 Database seeding completed successfully!');
}
