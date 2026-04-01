export interface DashboardKPIs {
  ca: { realise: number; previsionnel: number; tauxRealisation: number; trend: number };
  margeARS: { value: number; trend: number };
  tresorerie: { value: number; trend: number };
  affaires: { total: number; nouvelles: number; enCours: number; trend: number };
  cedantes: { actives: number; total: number; trend: number };
  sinistres: { ouverts: number; total: number; montantTotal: number; tauxSinistralite: number; trend: number };
  primesAEncaisser: { montant: number; count: number; retardMoyen: number };
  paiementsEnRetard: { count: number; montant: number };
}

export interface CAEvolutionData {
  month: string;
  previsionnel: number;
  realise: number;
  target: number;
}

export interface CACedanteData {
  cedanteId: string;
  cedanteName: string;
  ca: number;
  percentage: number;
  affairesCount: number;
}

export interface CAReassureurData {
  reassureurId: string;
  reassureurName: string;
  ca: number;
  percentage: number;
  affairesCount: number;
}

export interface CABrancheData {
  branche: string;
  facultative: number;
  traitee: number;
  total: number;
}

export interface SinistreTrendData {
  month: string;
  primes: number;
  sinistres: number;
  tauxSinistralite: number;
}

export interface TopAffaire {
  id: string;
  numeroAffaire: string;
  cedanteName: string;
  reassureurName: string;
  prime: number;
  commissionARS: number;
  status: string;
  paymentStatus: string;
}

export interface SinistreMajeur {
  id: string;
  numeroSinistre: string;
  affaireNumero: string;
  cedanteName: string;
  montant: number;
  dateOccurrence: string;
  status: string;
  joursOuvert: number;
}

export interface Echeance {
  id: string;
  type: 'paiement_client' | 'paiement_reassureur' | 'bordereau' | 'rapport';
  affaireNumero?: string;
  montant?: number;
  dateEcheance: string;
  responsable: string;
  status: string;
}

export interface Alert {
  id: string;
  type: 'financial' | 'operational' | 'deadline';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

export interface CashFlowData {
  date: string;
  encaissements: number;
  decaissements: number;
  solde: number;
}
