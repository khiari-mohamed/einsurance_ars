import { useState } from 'react';
import {
  Home, Users, FileText, AlertTriangle, DollarSign,
  BookOpen, BarChart3, FolderOpen, Settings, Receipt,
  BookOpenCheck, ChevronRight, Zap,
  Shield, TrendingUp, Globe, FileCheck,
  PieChart, Database, Bell, Lock, Search, Download,
  RefreshCw, CheckCircle, Clock, Star,
  UserCheck, Wallet, Scale,
  Activity, Package, FileBarChart, HardDrive, Upload,
  Layers, Link2, Play, Calendar, Calculator,
} from 'lucide-react';

// ReceiptText not available in this lucide version — use Receipt as alias
const ReceiptText = Receipt;

// ─── DATA ────────────────────────────────────────────────────────────────────

// NEW FEATURES ADDED IN LATEST UPDATE
const NEW_FEATURES = [
  {
    name: 'Flux 4 Étapes',
    module: 'Finance',
    route: '/finances/4-step-wizard',
    description: 'Wizard complet pour le flux de paiement facultatif en 4 étapes (Client ARS)',
    icon: Wallet,
    color: '#16A34A',
  },
  {
    name: 'Générateur Situation',
    module: 'Finance',
    route: '/finances/situation-builder',
    description: 'Constructeur de situations avec netting automatique débit/crédit',
    icon: Calculator,
    color: '#16A34A',
  },
  {
    name: 'Tableaux de Bord',
    module: 'Reporting',
    route: '/reporting/dashboard-panels',
    description: '4 panels requis: CA, Aging, Budget vs Actuel, Rapport Trimestriel',
    icon: PieChart,
    color: '#0891B2',
  },
  {
    name: 'Générateur Rapports',
    module: 'Reporting',
    route: '/reporting/generator',
    description: 'Génération de tous les rapports officiels (Note de Débit, Bordereau, etc.)',
    icon: FileBarChart,
    color: '#0891B2',
  },
  {
    name: 'Paramètres Société',
    module: 'Administration',
    route: '/admin/company-settings',
    description: 'Configuration complète en 6 tabs (Fichier module)',
    icon: Settings,
    color: '#475569',
  },
  {
    name: 'Taux de Change',
    module: 'Administration',
    route: '/admin/exchange-rates',
    description: 'Gestion FX avec dual-rate (taux réalisation + taux règlement)',
    icon: TrendingUp,
    color: '#475569',
  },
  {
    name: 'Notifications',
    module: 'Workflow',
    route: '/workflow/notifications',
    description: 'Gestion des tâches et notifications en temps réel',
    icon: Bell,
    color: '#DC2626',
  },
  {
    name: 'Checklist Documents',
    module: 'GED',
    route: '/affaires/:id (embedded)',
    description: 'Suivi des documents obligatoires par affaire avec upload',
    icon: FileCheck,
    color: '#7C3AED',
  },
  {
    name: 'Échéancier PMD',
    module: 'Affaires',
    route: '/affaires/:id (embedded)',
    description: 'Configuration des échéances de paiement pour traités',
    icon: Calendar,
    color: '#7C3AED',
  },
  {
    name: 'Upload SWIFT',
    module: 'Finance',
    route: '/finances/payments/:id (embedded)',
    description: 'Attachment de confirmation SWIFT pour paiements',
    icon: Upload,
    color: '#16A34A',
  },
];

const SIDEBAR_MODULES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Home,
    color: '#2563EB',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
    badge: 'Vue d\'ensemble',
    description: 'Tableau de bord central avec KPIs en temps réel. Premier écran après connexion.',
    utility: 'Offre une vision globale immédiate de l\'activité : chiffre d\'affaires, primes, sinistres et alertes urgentes. Conçu pour la direction et les responsables qui ont besoin d\'un aperçu rapide sans naviguer dans les modules détaillés.',
    subItems: [],
    features: [
      { icon: PieChart, label: 'CA par axe', desc: 'Par affaire, cédante, réassureur ou combiné' },
      { icon: TrendingUp, label: 'Primes aging', desc: 'Encaissées vs non-encaissées avec vieillissement 0-30/31-60/61-90/90+ jours' },
      { icon: Activity, label: 'Budget vs Actuel', desc: 'Objectifs annuels vs réalisé avec variance %' },
      { icon: Bell, label: 'Alertes métier', desc: 'Échéances, sinistres en attente, SWIFT manquants' },
    ],
    connections: ['Reçoit données de tous les modules', 'Agrège Finance + Affaires + Sinistres'],
    who: ['Direction Générale', 'Direction Réassurance', 'DAF'],
  },

  {
    id: 'donnees',
    name: 'Données de Base',
    icon: Users,
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    badge: 'Master Data',
    description: 'Référentiel central de tous vos partenaires commerciaux. Point de départ obligatoire.',
    utility: 'Avant toute opération, tous les tiers doivent être créés ici. Chaque fiche génère un code unique et un compte comptable lié automatiquement. C\'est le fondement sur lequel repose tout le système.',
    subItems: [
      { name: 'Assurés', desc: 'Clients finaux avec contrats et contacts' },
      { name: 'Cédantes', desc: 'Compagnies d\'assurance — compte 411xxxxx' },
      { name: 'Réassureurs', desc: 'Partenaires réassurance — compte 401xxxxx' },
      { name: 'Co-Courtiers', desc: 'Partenaires de distribution avec RIB multi-devises' },
    ],
    features: [
      { icon: UserCheck, label: 'Code auto', desc: 'Code unique attribué automatiquement à la validation' },
      { icon: Database, label: 'Comptes liés', desc: '411xxxxx pour cédantes, 401xxxxx pour réassureurs' },
      { icon: Globe, label: 'Multi-devises', desc: 'RIB par devise (TND, USD, EUR…) avec SWIFT/BIC' },
      { icon: FolderOpen, label: 'Conventions GED', desc: 'Accord signé attaché directement à la fiche' },
    ],
    connections: ['→ Affaires (obligatoire avant)', '→ Bordereaux', '→ Finance', '→ Comptabilité'],
    who: ['Direction Réassurance', 'Direction Commerciale'],
  },

  {
    id: 'affaires',
    name: 'Affaires',
    icon: FileText,
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    badge: 'Cœur Métier',
    description: 'Module central de la plateforme. Gère tous les placements facultatifs et traités.',
    utility: 'Cœur battant de l\'application. Chaque affaire créée ici déclenche automatiquement les calculs de primes/commissions, génère les bordereaux et alimente la comptabilité. Deux types : Facultatif (risque par risque) et Traité (portefeuille).',
    subItems: [
      { name: 'Toutes les Affaires', desc: 'Liste globale avec filtres avancés par statut, type, cédante' },
      { name: 'Facultatives', desc: 'Placements individuels risque par risque' },
      { name: 'Traités', desc: 'Conventions de réassurance en portefeuille (QP, XOL, Stop-Loss)' },
    ],
    features: [
      { icon: Zap, label: 'Calcul automatique', desc: 'Primes, commissions cédantes et ARS calculées en temps réel' },
      { icon: Layers, label: 'Workflow statut', desc: 'Cotation → Prévision → Placement réalisé avec rôles' },
      { icon: Users, label: 'Pool réassureurs', desc: 'Répartition % par réassureur (total = 100%), leader flagué' },
      { icon: FileCheck, label: 'Checklist docs', desc: 'Note de synthèse, slip de cotation, ordres d\'assurance' },
    ],
    connections: ['← Données de Base (requis)', '→ Bordereaux (auto)', '→ Sinistres', '→ Finance', '→ Comptabilité'],
    who: ['Direction Réassurance', 'Direction Commerciale'],
  },

  {
    id: 'bordereaux',
    name: 'Bordereaux',
    icon: Receipt,
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    badge: 'Documents légaux',
    description: 'Génération et suivi des bordereaux de cession et situations périodiques.',
    utility: 'Module qui transforme les données des affaires en documents légaux officiels. Les bordereaux sont les pièces comptables qui justifient chaque opération de réassurance vis-à-vis des cédantes et des réassureurs. Inclut le calcul du "montant en lettres" obligatoire.',
    subItems: [
      { name: 'Tous les Bordereaux', desc: 'Vue consolidée de tous les bordereaux émis' },
      { name: 'Cédantes', desc: 'Notes de débit — ce que la cédante doit à ARS' },
      { name: 'Réassureurs', desc: 'Ce qu\'ARS doit à chaque réassureur selon sa part %' },
      { name: 'Sinistres', desc: 'Comptes de sinistres avec récupérations' },
      { name: 'Situations', desc: 'Netting périodique débit/crédit (trimestre, semestre, annuel)' },
      { name: 'Dashboard', desc: 'Vue synthétique des bordereaux émis et en attente' },
    ],
    features: [
      { icon: ReceiptText, label: 'Note de débit', desc: 'Document légal avec montant en lettres automatique' },
      { icon: Scale, label: 'Netting situations', desc: 'Σ primes − Σ sinistres = solde net payable' },
      { icon: Download, label: 'Export PDF/Excel', desc: 'Impression directe ou export pour archivage' },
      { icon: Link2, label: 'Lié aux affaires', desc: 'Chaque bordereau tracé à son affaire source' },
    ],
    connections: ['← Affaires', '← Sinistres', '→ Finance (déclenchement paiement)', '→ Comptabilité (écritures)'],
    who: ['Direction Réassurance', 'DAF'],
  },

  {
    id: 'sinistres',
    name: 'Sinistres',
    icon: AlertTriangle,
    color: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
    badge: 'Gestion sinistres',
    description: 'Cycle de vie complet des sinistres : déclaration, validation, réserves, récupération.',
    utility: 'Gère tout événement sinistre de sa déclaration à sa clôture. Workflow en 7 étapes avec validation directeur. Calcule automatiquement la part de chaque réassureur. Déclenche des notifications pour les cash calls et les seuils de notification traité.',
    subItems: [
      { name: 'Enregistrer', desc: 'Nouvelle déclaration de sinistre reçue de la cédante' },
      { name: 'Liste', desc: 'Tous les sinistres avec filtres par affaire, statut, date' },
      { name: 'Suivi', desc: 'Timeline événements : déclaration → validation → recouvrement → clôture' },
      { name: 'Réserves & SAP', desc: 'Sinistres à Payer au 31/12, réserves constituées et libérées' },
    ],
    features: [
      { icon: Clock, label: 'Timeline 7 étapes', desc: 'Log horodaté par acteur : déclaration, validation, comptabilisation…' },
      { icon: Bell, label: 'Cash calls', desc: 'Alerte et suivi pour sinistres dépassant le seuil traité' },
      { icon: Shield, label: 'Validation directeur', desc: 'Approbation obligatoire avant notification réassureurs' },
      { icon: Wallet, label: 'SAP annuel', desc: 'Déclaration des réserves au 31 décembre pour chaque exercice' },
    ],
    connections: ['← Affaires (rattaché)', '→ Bordereaux (bordereau sinistre)', '→ Finance (récupération)', '→ Comptabilité (écritures réserves)'],
    who: ['Service IRDS', 'Direction Réassurance', 'Direction Technique'],
  },

  {
    id: 'finance',
    name: 'Finance',
    icon: DollarSign,
    color: '#16A34A',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
    badge: 'Flux financiers',
    description: 'Gestion complète des encaissements, décaissements, commissions et règlements.',
    utility: 'Enregistre chaque mouvement d\'argent. Gère le flux en 4 étapes pour les clients ARS, les situations de netting pour les traités, et le lettrage automatique des paiements contre les bordereaux ouverts. Calcule automatiquement les gains/pertes de change.',
    subItems: [
      { name: 'Transactions', desc: 'Register d\'encaissements et décaissements' },
      { name: 'Commissions', desc: 'Suivi des commissions ARS, cédantes et co-courtiers' },
      { name: 'Situations', desc: 'Situations périodiques avec netting débit/crédit' },
      { name: 'Générateur Situation', desc: '✨ NOUVEAU: Constructeur de situations batch avec netting' },
      { name: 'Flux 4 Étapes', desc: '✨ NOUVEAU: Wizard paiement facultatif Client ARS' },
      { name: 'Ordres Paiement', desc: 'Génération des ordres de virement (document légal PDF)' },
      { name: 'Dashboard', desc: 'Vue financière : trésorerie, flux en attente, aging' },
    ],
    features: [
      { icon: RefreshCw, label: 'Lettrage auto', desc: 'Matching paiements vs bordereaux ouverts — résidu calculé' },
      { icon: Globe, label: 'Multi-devises FX', desc: 'Taux réalisation vs règlement → gain/perte de change auto' },
      { icon: Wallet, label: 'Ordre de virement', desc: 'PDF légal avec bénéficiaire, RIB, SWIFT, montant, signatures' },
      { icon: Upload, label: 'SWIFT upload', desc: 'Confirmation bancaire attachée — paiement flagué jusqu\'à réception' },
    ],
    connections: ['← Bordereaux (paiements déclenchés)', '← Sinistres (récupérations)', '→ Comptabilité (écritures bank)', '→ GED (ordres + SWIFT)'],
    who: ['DAF', 'Direction Réassurance'],
  },

  {
    id: 'comptabilite',
    name: 'Comptabilité',
    icon: BookOpen,
    color: '#4F46E5',
    gradient: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
    badge: 'Automatique',
    description: 'Écritures comptables automatiques et états financiers complets.',
    utility: 'Chaque transaction financière génère automatiquement des écritures comptables en brouillon. Le comptable valide et exporte. Aucune double saisie : la comptabilité est la conséquence directe des opérations métier enregistrées dans les autres modules.',
    subItems: [
      { name: 'Dashboard', desc: 'Vue synthétique : soldes, écritures en attente, balance' },
      { name: 'Plan Comptable', desc: 'Arborescence des comptes (général + auxiliaires 411/401)' },
      { name: 'Grand Livre', desc: 'Détail de toutes les écritures par compte' },
      { name: 'Balance', desc: 'Balance des comptes avec débit/crédit et solde' },
      { name: 'Bilan', desc: 'Bilan comptable actif/passif' },
      { name: 'Compte Résultat', desc: 'Charges vs produits, résultat net' },
      { name: 'Journal Ventes', desc: 'Toutes les écritures de produits (primes, commissions ARS)' },
      { name: 'Journal Achats', desc: 'Écritures fournisseurs (primes réassureurs, commissions cédantes)' },
      { name: 'Journal Banque', desc: 'Mouvements bancaires (encaissements, paiements)' },
      { name: 'Réconciliation', desc: 'Rapprochement bancaire et lettrage final' },
    ],
    features: [
      { icon: Zap, label: 'Génération auto', desc: '3 événements : passation CA, encaissement prime, règlement réassureur' },
      { icon: CheckCircle, label: 'Brouillon → Validé', desc: 'Workflow comptable avant intégration définitive' },
      { icon: FileBarChart, label: 'Export intégration', desc: 'Fichier TXT/Excel pour système comptable externe' },
      { icon: Scale, label: 'Gain/perte change', desc: 'Écritures FX auto sur différence taux réalisation vs règlement' },
    ],
    connections: ['← Finance (chaque paiement)', '← Bordereaux (chaque cession)', '← Sinistres (réserves)', 'Export → Système externe'],
    who: ['DAF', 'Service Comptabilité'],
  },

  {
    id: 'reporting',
    name: 'Reporting',
    icon: BarChart3,
    color: '#0891B2',
    gradient: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)',
    badge: 'Analyses',
    description: 'Tableaux de bord analytiques et exports réglementaires pour la direction.',
    utility: 'Agrège les données de tous les modules pour produire des rapports décisionnels. Permet d\'exporter les états réglementaires obligatoires et les rapports de performance pour la direction générale et le service financier.',
    subItems: [
      { name: 'Dashboard', desc: 'Analytics : CA par axe, performance, KPIs direction' },
      { name: 'Tableaux de Bord', desc: '✨ NOUVEAU: 4 panels complets (CA, Aging, Budget, Trimestriel)' },
      { name: 'Portfolio', desc: 'Analyse du portefeuille : répartition, sinistralité, rentabilité' },
      { name: 'Générateur Rapports', desc: '✨ NOUVEAU: Tous les rapports officiels (Note Débit, etc.)' },
      { name: 'Exports & Rapports', desc: 'PDF/Excel : bordereaux, situations, rapports réglementaires' },
    ],
    features: [
      { icon: PieChart, label: 'CA multi-axes', desc: 'Par affaire / cédante / réassureur / combiné, filtrable par période' },
      { icon: TrendingUp, label: 'Budget vs actuel', desc: 'Objectifs annuels saisis par la direction, variance calculée' },
      { icon: Download, label: 'Exports formats', desc: 'PDF imprimable + Excel pour analyses complémentaires' },
      { icon: FileBarChart, label: 'Rapport trimestriel', desc: 'CA trimestriel communiqué formellement au service financier' },
    ],
    connections: ['← Toutes les données métier', '← Finance', '← Affaires', '← Sinistres'],
    who: ['Direction Générale', 'Direction Réassurance', 'DAF'],
  },

  {
    id: 'ged',
    name: 'GED',
    icon: FolderOpen,
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)',
    badge: 'Transversal',
    description: 'Gestion Électronique des Documents — module transversal lié à tous les enregistrements.',
    utility: 'Chaque fiche (affaire, cédante, sinistre, paiement…) possède un onglet GED. Centralise tous les documents avec classification, recherche et checklist de complétude. Élimine la gestion papier et les dossiers dispersés.',
    subItems: [],
    features: [
      { icon: Search, label: 'Recherche globale', desc: 'Par type de document, entité, période ou mots-clés' },
      { icon: FileCheck, label: 'Checklist affaire', desc: 'Note de synthèse, slip, convention — statut : Manquant/En attente/Reçu' },
      { icon: Upload, label: 'SWIFT slot', desc: 'Emplacement dédié par paiement — flagué jusqu\'à confirmation reçue' },
      { icon: FolderOpen, label: 'Panneaux intégrés', desc: 'Onglet Documents dans chaque module (Affaires, Sinistres, Finance…)' },
    ],
    connections: ['↔ Tous les modules (transversal)', 'Données de Base (conventions)', 'Affaires (checklist)', 'Finance (SWIFT)'],
    who: ['Tous les profils'],
  },

  {
    id: 'workflow',
    name: 'Workflow',
    icon: Bell,
    color: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
    badge: '✨ NOUVEAU',
    description: 'Gestion des tâches, notifications et workflow inter-départements.',
    utility: 'Centralise toutes les tâches en attente et notifications système. Gère les validations (sinistres, affaires), les handoffs inter-départements (Chargé → DAF), et les alertes métier (SWIFT manquant, seuil dépassé, échéance PMD).',
    subItems: [
      { name: 'Historique', desc: 'Historique complet des workflows exécutés' },
      { name: 'Notifications', desc: '✨ NOUVEAU: Tâches en temps réel avec WebSocket' },
    ],
    features: [
      { icon: Bell, label: 'Temps réel', desc: 'WebSocket pour notifications instantanées' },
      { icon: CheckCircle, label: 'Tâches', desc: 'Validation sinistres, handoff DAF, approbations' },
      { icon: AlertTriangle, label: 'Alertes métier', desc: 'SWIFT manquant, seuil traité, échéance PMD' },
      { icon: Clock, label: 'Priorités', desc: 'Low / Medium / High / Urgent avec filtres' },
    ],
    connections: ['← Tous les modules (notifications)', '→ Utilisateurs (assignation tâches)'],
    who: ['Tous les profils'],
  },

  {
    id: 'administration',
    name: 'Administration',
    icon: Settings,
    color: '#475569',
    gradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
    badge: 'Système',
    description: 'Configuration système, gestion des utilisateurs et paramètres société.',
    utility: 'Module réservé aux administrateurs. Configure les règles qui gouvernent tout le système : taux de change BCT, droits d\'accès par profil, paramètres société utilisés dans les documents légaux. Gère les sauvegardes et l\'import/export de données.',
    subItems: [
      { name: 'Utilisateurs', desc: 'Création/modification des utilisateurs avec leurs 5 profils' },
      { name: 'Paramètres Société', desc: '✨ NOUVEAU: Fiche société complète (6 onglets)' },
      { name: 'Taux de Change', desc: '✨ NOUVEAU: Table BCT avec dual-rate (réalisation + règlement)' },
      { name: 'Sauvegardes', desc: 'Backup manuel ou planifié de la base de données' },
      { name: 'Import/Export', desc: 'Import de données (TXT, Excel, PDF), export global' },
      { name: 'Système', desc: 'Logs d\'audit, historique des actions utilisateurs' },
    ],
    features: [
      { icon: Lock, label: '5 profils RBAC', desc: 'Direction Com., Réassurance, Générale, DAF, Service IRDS' },
      { icon: Globe, label: 'Taux BCT dual', desc: 'Taux réalisation (booking) et taux règlement (paiement) stockés séparément' },
      { icon: HardDrive, label: 'Sauvegardes auto', desc: 'Planifiées + manuelles, restauration possible' },
      { icon: Package, label: 'Fiche société', desc: '6 onglets : toutes les données légales et fiscales d\'ARS' },
    ],
    connections: ['→ Fournit config à TOUS les modules', '→ Taux de change (Finance + Compta)', '→ Droits (chaque écran)'],
    who: ['Administrateur Système'],
  },
];

const WORKFLOW = [
  { step: 1, module: 'Administration', action: 'Configurer la société et créer les utilisateurs', icon: Settings, color: '#475569' },
  { step: 2, module: 'Données de Base', action: 'Créer Cédantes, Réassureurs, Assurés', icon: Users, color: '#059669' },
  { step: 3, module: 'Affaires', action: 'Créer l\'affaire (Facultative ou Traité)', icon: FileText, color: '#7C3AED' },
  { step: 4, module: 'Bordereaux', action: 'Génération automatique des bordereaux', icon: Receipt, color: '#D97706' },
  { step: 5, module: 'Sinistres', action: 'Déclarer et valider si sinistre survient', icon: AlertTriangle, color: '#DC2626' },
  { step: 6, module: 'Finance', action: 'Enregistrer encaissements & paiements', icon: DollarSign, color: '#16A34A' },
  { step: 7, module: 'Comptabilité', action: 'Valider les écritures auto générées', icon: BookOpen, color: '#4F46E5' },
  { step: 8, module: 'Reporting', action: 'Analyser & exporter les états', icon: BarChart3, color: '#0891B2' },
];

const ROLES = [
  { name: 'Direction Commerciale', color: '#7C3AED', modules: ['Affaires (cotation)', 'Données de Base'], access: 'Création affaires en cotation' },
  { name: 'Direction Réassurance', color: '#2563EB', modules: ['Affaires', 'Bordereaux', 'Sinistres', 'GED'], access: 'Accès technique complet' },
  { name: 'Direction Générale', color: '#059669', modules: ['Dashboard', 'Reporting'], access: 'Lecture seule + KPIs' },
  { name: 'DAF', color: '#D97706', modules: ['Finance', 'Comptabilité', 'Ordres Paiement'], access: 'Finance et comptabilité complet' },
  { name: 'Service IRDS', color: '#DC2626', modules: ['Sinistres'], access: 'Suivi sinistres uniquement' },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────


const FLOW_NODES = [
  { id: 'admin',     label: 'Administration',  short: 'Config & Users',      color: '#64748B', x: 20,  y: 20 },
  { id: 'donnees',   label: 'Données de Base', short: 'Cédantes / Réass.',   color: '#059669', x: 185, y: 20 },
  { id: 'affaires',  label: 'Affaires',         short: 'Fac. / Traité',       color: '#7C3AED', x: 350, y: 20 },
  { id: 'bord',      label: 'Bordereaux',        short: 'Génération auto',     color: '#D97706', x: 515, y: 20 },
  { id: 'sinistres', label: 'Sinistres',          short: 'Déclarer / Valider',  color: '#DC2626', x: 515, y: 150 },
  { id: 'finance',   label: 'Finance',            short: 'Encaiss. / Paiem.',   color: '#16A34A', x: 350, y: 150 },
  { id: 'compta',    label: 'Comptabilité',       short: 'Écritures auto',      color: '#4F46E5', x: 185, y: 150 },
  { id: 'reporting', label: 'Reporting',          short: 'Analyser & Exporter', color: '#0891B2', x: 20,  y: 150 },
];

const NODE_W = 145;
const NODE_H = 64;

const FLOW_EDGES: Array<{ from: string; to: string; label?: string }> = [
  { from: 'admin',    to: 'donnees',   label: '' },
  { from: 'donnees',  to: 'affaires',  label: 'requis' },
  { from: 'affaires', to: 'bord',      label: 'génère' },
  { from: 'bord',     to: 'sinistres', label: '' },
  { from: 'bord',     to: 'finance',   label: '' },
  { from: 'sinistres',to: 'finance',   label: 'récup.' },
  { from: 'finance',  to: 'compta',    label: 'écritures' },
  { from: 'compta',   to: 'reporting', label: '' },
  { from: 'affaires', to: 'sinistres', label: 'rattaché' },
];

function WorkflowDiagram() {
  const [active, setActive] = useState<string | null>('admin');

  useState(() => {
    const ids = FLOW_NODES.map(n => n.id);
    let i = 0;
    const iv = setInterval(() => {
      setActive(ids[i % ids.length]);
      i++;
    }, 1400);
    return () => clearInterval(iv);
  });

  const getNode = (id: string) => FLOW_NODES.find(n => n.id === id)!;
  const ncx = (n: typeof FLOW_NODES[0]) => n.x + NODE_W / 2;
  const ncy = (n: typeof FLOW_NODES[0]) => n.y + NODE_H / 2;

  const getEdgePoints = (from: typeof FLOW_NODES[0], to: typeof FLOW_NODES[0]) => {
    const sameRow = Math.abs(from.y - to.y) < 10;
    if (sameRow) {
      const goRight = to.x > from.x;
      return {
        x1: goRight ? from.x + NODE_W : from.x,
        y1: ncy(from),
        x2: goRight ? to.x : to.x + NODE_W,
        y2: ncy(to),
      };
    }
    const goDown = to.y > from.y;
    return {
      x1: ncx(from),
      y1: goDown ? from.y + NODE_H : from.y,
      x2: ncx(to),
      y2: goDown ? to.y : to.y + NODE_H,
    };
  };

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      <svg width="100%" viewBox="0 0 680 240" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <marker id="wfa" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
          <style>{`@keyframes wfp{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
        </defs>

        {/* Edges */}
        {FLOW_EDGES.map((edge, i) => {
          const from = getNode(edge.from);
          const to = getNode(edge.to);
          if (!from || !to) return null;
          const { x1, y1, x2, y2 } = getEdgePoints(from, to);
          const isHot = active === edge.from || active === edge.to;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isHot ? from.color : 'rgba(255,255,255,0.1)'}
                strokeWidth={isHot ? 2 : 0.75}
                strokeDasharray={isHot ? 'none' : '5 4'}
                markerEnd="url(#wfa)"
                style={{ transition: 'stroke 0.35s, stroke-width 0.35s' }}
              />
              {edge.label && isHot && (
                <text x={midX} y={midY - 7} textAnchor="middle"
                  style={{ fontSize: '8.5px', fontWeight: 700, fill: from.color, letterSpacing: '0.2px' }}>
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {FLOW_NODES.map((node, i) => {
          const isActive = active === node.id;
          return (
            <g key={node.id} onClick={() => setActive(node.id)} style={{ cursor: 'pointer' }}>
              {isActive && (
                <rect x={node.x - 5} y={node.y - 5} width={NODE_W + 10} height={NODE_H + 10}
                  rx={15} fill="none" stroke={node.color} strokeWidth={1.5}
                  style={{ opacity: 0.6, animation: 'wfp 1.1s ease-in-out infinite' }}/>
              )}
              <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10}
                fill={isActive ? `${node.color}1A` : 'rgba(255,255,255,0.03)'}
                stroke={isActive ? node.color : 'rgba(255,255,255,0.1)'}
                strokeWidth={isActive ? 1.5 : 0.75}
                style={{ transition: 'all 0.35s' }}/>
              {/* Step badge */}
              <circle cx={node.x + 15} cy={node.y + 15} r={10}
                fill={isActive ? node.color : 'rgba(255,255,255,0.07)'}
                style={{ transition: 'all 0.35s' }}/>
              <text x={node.x + 15} y={node.y + 15} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '9px', fontWeight: 900, fill: isActive ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.35s' }}>
                {i + 1}
              </text>
              {/* Module name */}
              <text x={node.x + NODE_W / 2} y={node.y + 31} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '10.5px', fontWeight: 700, fill: isActive ? node.color : 'rgba(255,255,255,0.65)', transition: 'all 0.35s' }}>
                {node.label}
              </text>
              {/* Subtitle */}
              <text x={node.x + NODE_W / 2} y={node.y + 48} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '8.5px', fill: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', transition: 'all 0.35s' }}>
                {node.short}
              </text>
            </g>
          );
        })}
      </svg>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '10.5px', margin: '6px 0 0', letterSpacing: '0.3px' }}>
        Cliquez sur un module · Les connexions s'animent automatiquement
      </p>
    </div>
  );
}

function ModuleDetail({ module, onClose }: { module: typeof SIDEBAR_MODULES[0]; onClose: () => void }) {
  const Icon = module.icon;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0F172A',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          maxWidth: '780px', width: '100%',
          maxHeight: '88vh', overflowY: 'auto',
          padding: '0',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          background: module.gradient,
          borderRadius: '24px 24px 0 0',
          padding: '32px',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '36px', height: '36px',
              color: '#fff', cursor: 'pointer', fontSize: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: '16px',
              width: '60px', height: '60px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={30} color="#fff" />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>{module.badge}</div>
              <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 800, margin: 0 }}>{module.name}</h2>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: '16px', fontSize: '15px', lineHeight: 1.6, margin: '16px 0 0' }}>{module.description}</p>
        </div>

        <div style={{ padding: '28px' }}>
          {/* Utility */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '20px', marginBottom: '24px',
          }}>
            <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '10px' }}>POURQUOI CE MODULE ?</div>
            <p style={{ color: '#CBD5E1', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>{module.utility}</p>
          </div>

          {/* Sub-items */}
          {module.subItems.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>SOUS-SECTIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {module.subItems.map((sub, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px', padding: '14px',
                  }}>
                    <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{sub.name}</div>
                    <div style={{ color: '#64748B', fontSize: '12px', lineHeight: 1.5 }}>{sub.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>FONCTIONNALITÉS CLÉS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {module.features.map((f, i) => {
                const FIcon = f.icon;
                return (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${module.color}33`,
                    borderRadius: '12px', padding: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <FIcon size={15} color={module.color} />
                      <span style={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 700 }}>{f.label}</span>
                    </div>
                    <div style={{ color: '#64748B', fontSize: '11px', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connections + Who */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '10px' }}>CONNEXIONS</div>
              {module.connections.map((c, i) => (
                <div key={i} style={{ color: '#CBD5E1', fontSize: '12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: module.color }}>›</span> {c}
                </div>
              ))}
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '10px' }}>QUI L'UTILISE ?</div>
              {module.who.map((w, i) => (
                <div key={i} style={{
                  display: 'inline-block', background: `${module.color}22`,
                  border: `1px solid ${module.color}44`, borderRadius: '20px',
                  padding: '3px 10px', fontSize: '11px', color: module.color,
                  marginRight: '6px', marginBottom: '6px', fontWeight: 600,
                }}>{w}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DemoGuide() {
  const [activeTab, setActiveTab] = useState<'modules' | 'new' | 'workflow' | 'roles'>('modules');
  const [selectedModule, setSelectedModule] = useState<typeof SIDEBAR_MODULES[0] | null>(null);


  return (
    <div style={{
      minHeight: '100vh',
      background: '#030712',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: '#E2E8F0',
    }}>

      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(37,99,235,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(124,58,237,0.06) 0%, transparent 50%)`,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── HERO ── */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              borderRadius: '14px', padding: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpenCheck size={22} color="#fff" />
            </div>
            <div style={{
              background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
              borderRadius: '20px', padding: '4px 14px',
              color: '#60A5FA', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px',
            }}>GUIDE DÉMO — ARS TUNISIE</div>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900,
            lineHeight: 1.1, margin: '0 0 16px',
            background: 'linear-gradient(135deg, #fff 0%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Plateforme de Gestion<br />
            <span style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Réassurance Intégrée</span>
          </h1>

          <p style={{ color: '#64748B', fontSize: '16px', lineHeight: 1.7, maxWidth: '600px', margin: '0 0 32px' }}>
            ERP métier complet pour le courtage en réassurance. 10 modules interconnectés couvrant
            le cycle de vie complet d'une affaire — de la cotation à la comptabilité.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { n: '10', label: 'Modules', color: '#2563EB' },
              { n: '5', label: 'Profils RBAC', color: '#7C3AED' },
              { n: '∞', label: 'Multi-devises', color: '#059669' },
              { n: 'Auto', label: 'Comptabilité', color: '#D97706' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: s.color }}>{s.n}</span>
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '40px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '6px',
          width: 'fit-content',
        }}>
          {[
            { id: 'modules', label: 'Modules Sidebar', icon: Layers },
            { id: 'new', label: '✨ Nouveautés', icon: Star },
            { id: 'workflow', label: 'Flux de Travail', icon: Play },
            { id: 'roles', label: 'Profils Accès', icon: Shield },
          ].map(tab => {
            const TIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', borderRadius: '12px',
                  border: 'none', cursor: 'pointer',
                  background: active ? 'linear-gradient(135deg, #2563EB, #7C3AED)' : 'transparent',
                  color: active ? '#fff' : '#64748B',
                  fontSize: '13px', fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: active ? '0 4px 20px rgba(37,99,235,0.4)' : 'none',
                }}
              >
                <TIcon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── NEW FEATURES TAB ── */}
        {activeTab === 'new' && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ color: '#E2E8F0', fontSize: '22px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Star size={24} color="#F59E0B" />
                Nouvelles Fonctionnalités
              </h2>
              <p style={{ color: '#64748B', fontSize: '14px' }}>
                10 composants ajoutés pour compléter les fonctionnalités manquantes. Tous prêts pour la démo.
              </p>
            </div>

            {/* Completion badge */}
            <div style={{
              marginBottom: '32px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(124,58,237,0.1))',
              border: '1px solid rgba(37,99,235,0.3)',
              borderRadius: '20px', padding: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: '#60A5FA', fontSize: '14px', fontWeight: 800, marginBottom: '6px' }}>Complétion du Projet</div>
                <div style={{ color: '#94A3B8', fontSize: '13px' }}>Frontend: 60-65% → <span style={{ color: '#10B981', fontWeight: 700 }}>85%</span> (+25%)</div>
                <div style={{ color: '#94A3B8', fontSize: '13px' }}>Overall: 65-70% → <span style={{ color: '#10B981', fontWeight: 700 }}>85-90%</span> (+20%)</div>
              </div>
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                background: 'conic-gradient(#10B981 0% 85%, rgba(255,255,255,0.1) 85% 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: '#0F172A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column',
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10B981' }}>85%</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Complété</div>
                </div>
              </div>
            </div>

            {/* New features grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {NEW_FEATURES.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${feature.color}33`,
                    borderRadius: '16px', padding: '18px',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${feature.color}66`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${feature.color}33`;
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: `${feature.color}22`, border: `1px solid ${feature.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={18} color={feature.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 800 }}>{feature.name}</span>
                          <span style={{
                            background: '#F59E0B22', border: '1px solid #F59E0B44',
                            borderRadius: '20px', padding: '2px 6px',
                            color: '#F59E0B', fontSize: '9px', fontWeight: 700,
                          }}>✨ NEW</span>
                        </div>
                        <div style={{ color: feature.color, fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>{feature.module}</div>
                      </div>
                    </div>
                    <p style={{ color: '#94A3B8', fontSize: '12px', lineHeight: 1.5, marginBottom: '10px' }}>
                      {feature.description}
                    </p>
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '8px', padding: '6px 10px',
                      fontSize: '11px', color: '#64748B', fontFamily: 'monospace',
                    }}>
                      {feature.route}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Implementation summary */}
            <div style={{
              marginTop: '32px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '16px', padding: '20px',
            }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  borderRadius: '10px', padding: '8px', flexShrink: 0,
                }}>
                  <CheckCircle size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ color: '#10B981', fontWeight: 800, marginBottom: '6px', fontSize: '14px' }}>Implémentation Complète</div>
                  <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
                    Tous les composants sont implémentés avec validation, gestion d'erreurs, et design professionnel.
                    Les routes sont configurées dans App.tsx et les menus ajoutés dans SidebarNav.tsx.
                    <strong style={{ color: '#10B981' }}> Prêt pour la démo!</strong>
                  </p>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['UI/UX Professionnel', 'Validation Forms', 'Error Handling', 'Responsive Design', 'Charts & Animations'].map((tag, i) => (
                      <span key={i} style={{
                        background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '20px', padding: '3px 10px',
                        color: '#10B981', fontSize: '11px', fontWeight: 600,
                      }}>✓ {tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODULES TAB ── */}
        {activeTab === 'modules' && (
          <div>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '28px' }}>
              Cliquez sur un module pour voir ses détails complets. Chaque module de la sidebar correspond à une section métier précise.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
              {SIDEBAR_MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '20px', overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.border = `1px solid ${mod.color}55`;
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    {/* Card header */}
                    <div style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{
                        background: mod.gradient, borderRadius: '14px',
                        width: '48px', height: '48px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 16px ${mod.color}55`,
                      }}>
                        <Icon size={22} color="#fff" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 800 }}>{mod.name}</span>
                          <span style={{
                            background: `${mod.color}22`, border: `1px solid ${mod.color}44`,
                            borderRadius: '20px', padding: '2px 8px',
                            color: mod.color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                          }}>{mod.badge}</span>
                        </div>
                        <p style={{ color: '#64748B', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    {/* Sub-items preview */}
                    {mod.subItems.length > 0 && (
                      <div style={{ padding: '0 20px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {mod.subItems.map((sub, i) => (
                          <span key={i} style={{
                            background: 'rgba(255,255,255,0.06)', borderRadius: '20px',
                            padding: '3px 10px', fontSize: '11px', color: '#94A3B8', fontWeight: 500,
                          }}>
                            {sub.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Connections row */}
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      padding: '12px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Link2 size={12} color="#475569" />
                        <span style={{ color: '#475569', fontSize: '11px' }}>
                          {mod.connections[0]}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedModule(mod)}
                        style={{
                          background: `${mod.color}22`, border: `1px solid ${mod.color}44`,
                          borderRadius: '8px', padding: '5px 12px',
                          color: mod.color, fontSize: '11px', fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        Voir détails <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WORKFLOW TAB ── */}
        {activeTab === 'workflow' && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ color: '#E2E8F0', fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                Cycle de Vie d'une Affaire
              </h2>
              <p style={{ color: '#64748B', fontSize: '14px' }}>
                8 étapes interconnectées — chaque étape alimente automatiquement la suivante. Une seule saisie, propagation complète.
              </p>
            </div>

            {/* Animated diagram */}
            <div style={{ marginBottom: '24px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <WorkflowDiagram />
            </div>

            {/* Grid list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {WORKFLOW.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${step.color}22`,
                    borderRadius: '12px', padding: '14px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: `${step.color}22`, border: `1px solid ${step.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={step.color} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ color: step.color, fontSize: '10px', fontWeight: 900 }}>{step.step}</span>
                        <span style={{ color: step.color, fontSize: '11px', fontWeight: 700 }}>{step.module}</span>
                      </div>
                      <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{step.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto propagation note */}
            <div style={{
              marginTop: '32px',
              background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '16px', padding: '20px',
              display: 'flex', gap: '14px', alignItems: 'flex-start',
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                borderRadius: '10px', padding: '8px', flexShrink: 0,
              }}>
                <Zap size={18} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#60A5FA', fontWeight: 800, marginBottom: '6px', fontSize: '14px' }}>Propagation Automatique</div>
                <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
                  La création d'une affaire génère automatiquement ses bordereaux → qui déclenchent les écritures
                  comptables en brouillon → qui sont validées par le comptable → et exportées vers le système externe.
                  Chaque étape est tracée avec horodatage et acteur identifié.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ROLES TAB ── */}
        {activeTab === 'roles' && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ color: '#E2E8F0', fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>5 Profils d'Accès (RBAC)</h2>
              <p style={{ color: '#64748B', fontSize: '14px' }}>
                Chaque utilisateur est assigné à un profil qui détermine exactement à quels modules et actions il a accès.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {ROLES.map((role, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${role.color}33`,
                  borderRadius: '20px', padding: '24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: `${role.color}22`, border: `1px solid ${role.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <UserCheck size={18} color={role.color} />
                    </div>
                    <div>
                      <div style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 800 }}>{role.name}</div>
                      <div style={{ color: role.color, fontSize: '11px', fontWeight: 600 }}>{role.access}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {role.modules.map((m, j) => (
                      <span key={j} style={{
                        background: `${role.color}15`, border: `1px solid ${role.color}33`,
                        borderRadius: '20px', padding: '4px 12px',
                        color: role.color, fontSize: '11px', fontWeight: 600,
                      }}>{m}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Access matrix note */}
            <div style={{
              marginTop: '28px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '20px',
            }}>
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>LOGIQUE D'ACCÈS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {[
                  { icon: CheckCircle, color: '#16A34A', text: 'Lecture seule : Direction Générale' },
                  { icon: Star, color: '#D97706', text: 'Accès complet : Direction Réassurance' },
                  { icon: Lock, color: '#DC2626', text: 'Module unique : Service IRDS' },
                  { icon: Shield, color: '#2563EB', text: 'Admin total : Administrateur Système' },
                ].map((item, i) => {
                  const IIcon = item.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IIcon size={16} color={item.color} />
                      <span style={{ color: '#94A3B8', fontSize: '13px' }}>{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODULE DETAIL MODAL ── */}
      {selectedModule && (
        <ModuleDetail module={selectedModule} onClose={() => setSelectedModule(null)} />
      )}
    </div>
  );
}