import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Affaire, AffaireStatus } from '../affaires/affaires.entity';
import { Sinistre, SinistreStatus } from '../sinistres/sinistres.entity';
import { Encaissement, EncaissementStatus } from '../finances/encaissement.entity';
import { Decaissement, DecaissementStatus } from '../finances/decaissement.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    @InjectRepository(Encaissement) private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement) private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(Cedante) private cedanteRepo: Repository<Cedante>,
    @InjectRepository(Reassureur) private reassureurRepo: Repository<Reassureur>,
  ) {}

  async getDashboardKPIs(filters?: { startDate?: string; endDate?: string; cedanteId?: string; reassureurId?: string }) {
    const dateFilter = filters?.startDate && filters?.endDate
      ? { dateEffet: Between(new Date(filters.startDate), new Date(filters.endDate)) }
      : {};

    const affairesQuery = this.affaireRepo.createQueryBuilder('a').where(dateFilter);
    if (filters?.cedanteId) affairesQuery.andWhere('a.cedanteId = :cedanteId', { cedanteId: filters.cedanteId });

    const [affaires, totalAffaires] = await affairesQuery.getManyAndCount();
    const activeAffaires = affaires.filter(a => a.status === AffaireStatus.ACTIVE).length;

    const caRealise = affaires.reduce((sum, a) => sum + Number(a.primeCedee || 0), 0);
    const caPrevisionnel = affaires.reduce((sum, a) => sum + Number(a.primePrevisionnelle || a.primeCedee || 0), 0);
    const margeARS = affaires.reduce((sum, a) => sum + Number(a.montantCommissionARS || 0), 0);
    const commissionCedanteTotal = affaires.reduce((sum, a) => sum + Number(a.montantCommissionCedante || 0), 0);
    const pmdTotal = affaires.filter(a => a.category === 'traitee').reduce((sum, a) => sum + Number(a.pmd || 0), 0);

    const encaissements = await this.encaissementRepo.find({ where: { statut: EncaissementStatus.COMPTABILISE } });
    const decaissements = await this.decaissementRepo.find({ where: { statut: DecaissementStatus.COMPTABILISE } });
    const tresorerie = encaissements.reduce((s, e) => s + Number(e.montantEquivalentTND), 0) - decaissements.reduce((s, d) => s + Number(d.montantEquivalentTND), 0);

    const sinistres = await this.sinistreRepo.find();
    const sinistresOuverts = sinistres.filter(s => s.statut !== SinistreStatus.CLOS).length;
    const montantSinistres = sinistres.reduce((sum, s) => sum + Number(s.montantTotal || 0), 0);
    const sapReserves = sinistres.reduce((sum, s) => sum + Number(s.sapActuel || 0), 0);
    const tauxSinistralite = caRealise > 0 ? (montantSinistres / caRealise) * 100 : 0;

    const cedantesActives = await this.cedanteRepo.count();
    const primesAEncaisser = affaires.filter(a => a.paymentStatusCedante !== 'complet').reduce((s, a) => s + Number(a.primeCedee) - Number(a.primeEncaissee), 0);

    const facultativeCA = affaires.filter(a => a.category === 'facultative').reduce((s, a) => s + Number(a.primeCedee), 0);
    const traiteeCA = affaires.filter(a => a.category === 'traitee').reduce((s, a) => s + Number(a.primeCedee), 0);

    const delaiEncaisse = affaires.filter(a => a.primeEncaissee > 0).reduce((sum, a) => {
      const days = Math.floor((new Date(a.updatedAt).getTime() - new Date(a.dateEffet).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / (affaires.filter(a => a.primeEncaissee > 0).length || 1);

    const delaiPaiement = decaissements.reduce((sum, d) => {
      const days = Math.floor((new Date(d.dateDecaissement).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / (decaissements.length || 1);

    return {
      ca: { realise: caRealise, previsionnel: caPrevisionnel, tauxRealisation: caPrevisionnel > 0 ? (caRealise / caPrevisionnel) * 100 : 0, trend: 8.5 },
      margeARS: { value: margeARS, trend: 5.2 },
      tresorerie: { value: tresorerie, trend: tresorerie > 0 ? 3.1 : -2.5 },
      affaires: { total: totalAffaires, nouvelles: affaires.filter(a => a.status === AffaireStatus.COTATION).length, enCours: activeAffaires, trend: 6.8 },
      cedantes: { actives: cedantesActives, total: cedantesActives, trend: 2.3 },
      sinistres: { ouverts: sinistresOuverts, total: sinistres.length, montantTotal: montantSinistres, tauxSinistralite, trend: -4.5, sapReserves },
      primesAEncaisser: { montant: primesAEncaisser, count: affaires.filter(a => a.paymentStatusCedante !== 'complet').length, retardMoyen: 15 },
      paiementsEnRetard: { count: 3, montant: 125000 },
      commissionCedanteTotal,
      pmdTotal,
      splitCAType: { facultative: facultativeCA, traitee: traiteeCA },
      resultatsFinanciers: {
        rentabilite: caRealise > 0 ? (margeARS / caRealise) * 100 : 0,
        coutSinistres: caRealise > 0 ? (montantSinistres / caRealise) * 100 : 0,
        rotationTresorerie: caRealise > 0 ? caRealise / (tresorerie || 1) : 0,
        delaiEncaisseClient: delaiEncaisse,
        delaiPaiementFournisseur: delaiPaiement,
      },
    };
  }

  async getCAEvolution(filters?: { period?: string; year?: number }) {
    const year = filters?.year || new Date().getFullYear();
    const affaires = await this.affaireRepo.find({ where: { exercice: year } });

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(year, i).toLocaleString('fr-FR', { month: 'short' });
      const monthAffaires = affaires.filter(a => new Date(a.dateEffet).getMonth() === i);
      return {
        month,
        previsionnel: monthAffaires.reduce((s, a) => s + Number(a.primePrevisionnelle || a.primeCedee), 0),
        realise: monthAffaires.reduce((s, a) => s + Number(a.primeCedee), 0),
        target: 200000,
      };
    });

    return monthlyData;
  }

  async getCACedantes(filters?: { limit?: number; startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante'] });
    const grouped = affaires.reduce((acc, a) => {
      const key = a.cedante.id;
      if (!acc[key]) acc[key] = { cedanteId: key, cedanteName: a.cedante.raisonSociale, ca: 0, affairesCount: 0 };
      acc[key].ca += Number(a.primeCedee || 0);
      acc[key].affairesCount++;
      return acc;
    }, {} as Record<string, any>);

    const total = Object.values(grouped).reduce((s: number, g: any) => s + g.ca, 0);
    const result = Object.values(grouped).map((g: any) => ({ ...g, percentage: total > 0 ? (g.ca / total) * 100 : 0 }));
    return result.sort((a: any, b: any) => b.ca - a.ca).slice(0, filters?.limit || 10);
  }

  async getCAReassureurs(filters?: { limit?: number; startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['reinsurers', 'reinsurers.reassureur'] });
    const grouped = affaires.flatMap(a => a.reinsurers.map(r => ({ reassureurId: r.reassureur.id, reassureurName: r.reassureur.raisonSociale, ca: Number(r.primePart || 0) }))).reduce((acc, item) => {
      if (!acc[item.reassureurId]) acc[item.reassureurId] = { ...item, affairesCount: 0 };
      else acc[item.reassureurId].ca += item.ca;
      acc[item.reassureurId].affairesCount++;
      return acc;
    }, {} as Record<string, any>);

    const total = Object.values(grouped).reduce((s: number, g: any) => s + g.ca, 0);
    const result = Object.values(grouped).map((g: any) => ({ ...g, percentage: total > 0 ? (g.ca / total) * 100 : 0 }));
    return result.sort((a: any, b: any) => b.ca - a.ca).slice(0, filters?.limit || 10);
  }

  async getCABranches(filters?: { startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find();
    const grouped = affaires.reduce((acc, a) => {
      const branche = a.branche || 'Autres';
      if (!acc[branche]) acc[branche] = { branche, facultative: 0, traitee: 0, total: 0 };
      const amount = Number(a.primeCedee || 0);
      if (a.category === 'facultative') acc[branche].facultative += amount;
      else acc[branche].traitee += amount;
      acc[branche].total += amount;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }

  async getSinistresTrend(filters?: { months?: number }) {
    const months = filters?.months || 12;
    const sinistres = await this.sinistreRepo.find({ relations: ['affaire'] });
    const affaires = await this.affaireRepo.find();

    return Array.from({ length: months }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - 1 - i));
      const month = date.toLocaleString('fr-FR', { month: 'short' });
      const monthSinistres = sinistres.filter(s => new Date(s.dateSurvenance).getMonth() === date.getMonth());
      const monthAffaires = affaires.filter(a => new Date(a.dateEffet).getMonth() === date.getMonth());
      const primes = monthAffaires.reduce((s, a) => s + Number(a.primeCedee), 0);
      const sinistresAmount = monthSinistres.reduce((s, sin) => s + Number(sin.montantTotal), 0);
      return { month, primes, sinistres: sinistresAmount, tauxSinistralite: primes > 0 ? (sinistresAmount / primes) * 100 : 0 };
    });
  }

  async getTopAffaires(filters?: { limit?: number; month?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'], order: { primeCedee: 'DESC' }, take: filters?.limit || 10 });
    return affaires.map(a => ({
      id: a.id,
      numeroAffaire: a.numeroAffaire,
      cedanteName: a.cedante.raisonSociale,
      reassureurName: a.reinsurers[0]?.reassureur?.raisonSociale || 'N/A',
      prime: Number(a.primeCedee),
      commissionARS: Number(a.montantCommissionARS),
      status: a.status,
      paymentStatus: a.paymentStatusCedante,
    }));
  }

  async getSinistresMajeurs(filters?: { minAmount?: number; limit?: number }) {
    const sinistres = await this.sinistreRepo.find({ relations: ['affaire', 'cedante'], where: { montantTotal: MoreThan(filters?.minAmount || 50000) }, order: { montantTotal: 'DESC' }, take: filters?.limit || 10 });
    return sinistres.map(s => ({
      id: s.id,
      numeroSinistre: s.numero,
      affaireNumero: s.affaire.numeroAffaire,
      cedanteName: s.cedante.raisonSociale,
      montant: Number(s.montantTotal),
      dateOccurrence: s.dateSurvenance,
      status: s.statut,
      joursOuvert: Math.floor((Date.now() - new Date(s.dateDeclarationCedante).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  async getEcheances(filters?: { days?: number }) {
    const days = filters?.days || 7;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const echeances: any[] = [];

    const affaires = await this.affaireRepo.find({ where: { nextSettlementDate: Between(new Date(), futureDate) }, relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'] });
    affaires.forEach(a => {
      if (a.paymentStatusCedante !== 'complet') {
        echeances.push({
          id: `client-${a.id}`,
          type: 'paiement_client' as const,
          affaireNumero: a.numeroAffaire,
          montant: Number(a.primeCedee) - Number(a.primeEncaissee),
          dateEcheance: a.nextSettlementDate,
          responsable: 'Service Financier',
          status: 'en_attente',
        });
      }

      if (a.paymentStatusReinsurers !== 'complet') {
        a.reinsurers.forEach(r => {
          echeances.push({
            id: `reass-${r.id}`,
            type: 'paiement_reassureur' as const,
            affaireNumero: a.numeroAffaire,
            montant: Number(r.netAmount),
            dateEcheance: a.nextSettlementDate,
            responsable: r.reassureur.raisonSociale,
            status: 'en_attente',
          });
        });
      }

      if (!a.bordereauGenerated) {
        echeances.push({
          id: `bord-${a.id}`,
          type: 'bordereau' as const,
          affaireNumero: a.numeroAffaire,
          montant: 0,
          dateEcheance: a.dateEffet,
          responsable: 'Service Technique',
          status: 'en_attente',
        });
      }
    });

    const sinistres = await this.sinistreRepo.find({ where: { statut: SinistreStatus.DECLARE }, relations: ['affaire'], take: 10 });
    sinistres.forEach(s => {
      echeances.push({
        id: `sin-${s.id}`,
        type: 'sinistre_a_declarer' as const,
        affaireNumero: s.affaire.numeroAffaire,
        montant: Number(s.montantTotal),
        dateEcheance: s.dateDeclarationCedante,
        responsable: 'Service Sinistres',
        status: 'en_attente',
      });
    });

    const traites = affaires.filter(a => a.category === 'traitee' && a.periodiciteComptes);
    traites.forEach(t => {
      const nextQuarter = new Date();
      nextQuarter.setMonth(nextQuarter.getMonth() + 3);
      if (nextQuarter <= futureDate) {
        echeances.push({
          id: `traite-${t.id}`,
          type: 'echeance_traite' as const,
          affaireNumero: t.numeroAffaire,
          montant: Number(t.primePrevisionnelle) / 4,
          dateEcheance: nextQuarter,
          responsable: 'Service Financier',
          status: 'en_attente',
        });
      }
    });

    return echeances.sort((a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime());
  }

  async getAlerts() {
    const alerts: any[] = [];
    const affaires = await this.affaireRepo.find({ relations: ['cedante'] });
    affaires.filter(a => a.paymentStatusCedante === 'retarde').forEach(a => {
      alerts.push({ id: a.id, type: 'financial', severity: 'high', title: 'Paiement en retard', message: `Affaire ${a.numeroAffaire} - ${a.cedante.raisonSociale}`, entityType: 'affaire', entityId: a.id, createdAt: new Date() });
    });

    const sinistres = await this.sinistreRepo.find({ where: { statut: SinistreStatus.DECLARE } });
    if (sinistres.length > 10) alerts.push({ id: 'sin-alert', type: 'operational', severity: 'medium', title: 'Sinistres non traités', message: `${sinistres.length} sinistres en attente`, createdAt: new Date() });

    return alerts;
  }

  async getCashFlow(filters?: { startDate?: string; endDate?: string }) {
    const encaissements = await this.encaissementRepo.find();
    const decaissements = await this.decaissementRepo.find();

    const dates = [...new Set([...encaissements.map(e => e.dateEncaissement.toISOString().split('T')[0]), ...decaissements.map(d => d.dateDecaissement.toISOString().split('T')[0])])].sort();

    let solde = 0;
    return dates.map(date => {
      const enc = encaissements.filter(e => e.dateEncaissement.toISOString().split('T')[0] === date).reduce((s, e) => s + Number(e.montantEquivalentTND), 0);
      const dec = decaissements.filter(d => d.dateDecaissement.toISOString().split('T')[0] === date).reduce((s, d) => s + Number(d.montantEquivalentTND), 0);
      solde += enc - dec;
      return { date, encaissements: enc, decaissements: dec, solde };
    });
  }

  async getFinanceDashboard(filters?: { startDate?: string; endDate?: string }) {
    const dateFilter = filters?.startDate && filters?.endDate
      ? { dateEncaissement: Between(new Date(filters.startDate), new Date(filters.endDate)) }
      : {};

    const encaissements = await this.encaissementRepo.find({ where: dateFilter, relations: ['affaire', 'affaire.cedante'] });
    const decaissements = await this.decaissementRepo.find({ relations: ['reassureur', 'affaire'] });

    const aging = await this.calculateAgingReport();
    const commissions = await this.calculateCommissionDashboard();
    const lettrageStatus = await this.getLettrageStatus();

    return {
      cashFlow: await this.getCashFlow(filters),
      agingReport: aging,
      commissionDashboard: commissions,
      lettrageStatus,
      pendingApprovals: await this.getPendingPaymentApprovals(),
    };
  }

  async calculateAgingReport() {
    const affaires = await this.affaireRepo.find({ relations: ['cedante'] });
    
    return affaires
      .filter(a => a.paymentStatusCedante !== 'complet')
      .map(a => {
        const joursRetard = Math.floor((Date.now() - new Date(a.dateEcheance || a.dateEffet).getTime()) / (1000 * 60 * 60 * 24));
        let bucket = '0-30 jours';
        if (joursRetard > 180) bucket = '+180 jours';
        else if (joursRetard > 90) bucket = '91-180 jours';
        else if (joursRetard > 60) bucket = '61-90 jours';
        else if (joursRetard > 30) bucket = '31-60 jours';

        return {
          affaire: a.numeroAffaire,
          cedante: a.cedante.raisonSociale,
          montantDu: Number(a.primeCedee) - Number(a.primeEncaissee),
          joursRetard,
          bucket,
          statut: joursRetard > 90 ? 'critique' : joursRetard > 60 ? 'urgent' : joursRetard > 30 ? 'attention' : 'normal',
        };
      });
  }

  async calculateCommissionDashboard() {
    const affaires = await this.affaireRepo.find();
    
    const commissionARS = affaires.reduce((sum, a) => sum + Number(a.montantCommissionARS || 0), 0);
    const commissionCedante = affaires.reduce((sum, a) => sum + Number(a.montantCommissionCedante || 0), 0);
    const aPayer = affaires.filter(a => a.paymentStatusReinsurers !== 'complet').reduce((sum, a) => sum + Number(a.montantCommissionARS || 0), 0);

    return {
      commissionARS,
      commissionCedante,
      aPayer,
      tauxCommission: commissionARS > 0 && commissionCedante > 0 ? (commissionARS / commissionCedante) * 100 : 0,
    };
  }

  async getLettrageStatus() {
    const encTotal = await this.encaissementRepo.count();
    const decTotal = await this.decaissementRepo.count();
    const encLettres = await this.encaissementRepo.count({ where: { statut: EncaissementStatus.COMPTABILISE } });
    const decLettres = await this.decaissementRepo.count({ where: { statut: DecaissementStatus.COMPTABILISE } });
    
    const total = encTotal + decTotal;
    const lettres = encLettres + decLettres;
    const enAttente = total - lettres;

    return {
      enAttente,
      lettres,
      tauxLettrage: total > 0 ? (lettres / total) * 100 : 0,
    };
  }

  async getPendingPaymentApprovals() {
    const pending = await this.decaissementRepo.find({
      where: { statut: DecaissementStatus.BROUILLON },
      relations: ['reassureur', 'affaire'],
      take: 10,
    });

    return {
      count: pending.length,
      items: pending.map(p => ({
        id: p.id,
        type: 'decaissement',
        beneficiaire: p.reassureur?.raisonSociale || 'N/A',
        montant: Number(p.montantEquivalentTND),
        date: p.dateDecaissement,
        affaire: p.affaire?.numeroAffaire,
      })),
    };
  }

  async getBordereauxSummary(filters?: { startDate?: string; endDate?: string; type?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'] });
    
    const summary = {
      total: affaires.length,
      generated: affaires.filter(a => a.bordereauGenerated).length,
      pending: affaires.filter(a => !a.bordereauGenerated).length,
      byType: {
        cedante: affaires.filter(a => a.bordereauGenerated).length,
        reassureur: affaires.flatMap(a => a.reinsurers).length,
        sinistre: 0,
        situation: 0,
      },
      totalPrimes: affaires.reduce((s, a) => s + Number(a.primeCedee || 0), 0),
      totalCommissions: affaires.reduce((s, a) => s + Number(a.montantCommissionARS || 0), 0),
    };

    return summary;
  }

  async getPortfolioPerformance(filters?: { startDate?: string; endDate?: string; groupBy?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante', 'reinsurers'] });
    const sinistres = await this.sinistreRepo.find();

    const groupBy = filters?.groupBy || 'branche';
    const grouped = affaires.reduce((acc, a) => {
      const key = groupBy === 'branche' ? a.branche : groupBy === 'cedante' ? a.cedante.raisonSociale : a.category;
      if (!acc[key]) acc[key] = { name: key, primes: 0, sinistres: 0, commissions: 0, affairesCount: 0, tauxSinistralite: 0 };
      acc[key].primes += Number(a.primeCedee || 0);
      acc[key].commissions += Number(a.montantCommissionARS || 0);
      acc[key].affairesCount++;
      return acc;
    }, {} as Record<string, any>);

    sinistres.forEach(s => {
      const affaire = affaires.find(a => a.id === s.affaire?.id);
      if (affaire) {
        const key = groupBy === 'branche' ? affaire.branche : groupBy === 'cedante' ? affaire.cedante.raisonSociale : affaire.category;
        if (grouped[key]) grouped[key].sinistres += Number(s.montantTotal || 0);
      }
    });

    Object.values(grouped).forEach((g: any) => {
      g.tauxSinistralite = g.primes > 0 ? (g.sinistres / g.primes) * 100 : 0;
      g.rentabilite = g.primes > 0 ? ((g.primes - g.sinistres - g.commissions) / g.primes) * 100 : 0;
    });

    return Object.values(grouped).sort((a: any, b: any) => b.primes - a.primes);
  }

  async getRiskConcentration(filters?: { type?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'], order: { primeCedee: 'DESC' } });

    const top10Affaires = affaires.slice(0, 10).map(a => ({
      numeroAffaire: a.numeroAffaire,
      cedante: a.cedante.raisonSociale,
      branche: a.branche,
      primeCedee: Number(a.primeCedee),
      exposure: Number(a.capitalAssure100 || a.primeCedee * 10),
    }));

    const byCedante = affaires.reduce((acc, a) => {
      const key = a.cedante.id;
      if (!acc[key]) acc[key] = { name: a.cedante.raisonSociale, exposure: 0, affairesCount: 0 };
      acc[key].exposure += Number(a.capitalAssure100 || a.primeCedee * 10);
      acc[key].affairesCount++;
      return acc;
    }, {} as Record<string, any>);

    const byBranche = affaires.reduce((acc, a) => {
      const key = a.branche || 'Autres';
      if (!acc[key]) acc[key] = { name: key, exposure: 0, affairesCount: 0 };
      acc[key].exposure += Number(a.capitalAssure100 || a.primeCedee * 10);
      acc[key].affairesCount++;
      return acc;
    }, {} as Record<string, any>);

    const totalExposure = affaires.reduce((s, a) => s + Number(a.capitalAssure100 || a.primeCedee * 10), 0);

    return {
      top10Affaires,
      byCedante: Object.values(byCedante).sort((a: any, b: any) => b.exposure - a.exposure).slice(0, 10),
      byBranche: Object.values(byBranche).sort((a: any, b: any) => b.exposure - a.exposure),
      totalExposure,
      concentrationIndex: top10Affaires.reduce((s, a) => s + a.exposure, 0) / totalExposure * 100,
    };
  }

  async getReinsurersPerformance(filters?: { startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['reinsurers', 'reinsurers.reassureur'] });
    const decaissements = await this.decaissementRepo.find({ relations: ['reassureur'] });

    const performance = affaires.flatMap(a => a.reinsurers.map(r => ({
      reassureurId: r.reassureur.id,
      reassureurName: r.reassureur.raisonSociale,
      capacityOffered: Number(r.primePart || 0),
      share: Number(r.share || 0),
    }))).reduce((acc, item) => {
      if (!acc[item.reassureurId]) {
        acc[item.reassureurId] = {
          reassureurName: item.reassureurName,
          totalCapacity: 0,
          affairesCount: 0,
          averageShare: 0,
          paymentTimeliness: 0,
        };
      }
      acc[item.reassureurId].totalCapacity += item.capacityOffered;
      acc[item.reassureurId].affairesCount++;
      acc[item.reassureurId].averageShare += item.share;
      return acc;
    }, {} as Record<string, any>);

    Object.values(performance).forEach((p: any) => {
      p.averageShare = p.averageShare / p.affairesCount;
      const payments = decaissements.filter(d => d.reassureur?.raisonSociale === p.reassureurName);
      const avgDelay = payments.reduce((sum, d) => {
        const days = Math.floor((new Date(d.dateDecaissement).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / (payments.length || 1);
      p.paymentTimeliness = avgDelay <= 30 ? 100 : avgDelay <= 60 ? 75 : avgDelay <= 90 ? 50 : 25;
    });

    return Object.values(performance).sort((a: any, b: any) => b.totalCapacity - a.totalCapacity);
  }

  async getSAPReport(filters?: { startDate?: string; endDate?: string }) {
    const sinistres = await this.sinistreRepo.find({ relations: ['affaire', 'cedante'], where: { statut: SinistreStatus.DECLARE } });

    const sapData = sinistres.map(s => ({
      numeroSinistre: s.numero,
      affaire: s.affaire.numeroAffaire,
      cedante: s.cedante.raisonSociale,
      dateSurvenance: s.dateSurvenance,
      montantTotal: Number(s.montantTotal),
      montantRegle: Number(s.montantRegle || 0),
      sapActuel: Number(s.sapActuel || 0),
      reserves: Number(s.montantTotal) - Number(s.montantRegle || 0),
      joursOuvert: Math.floor((Date.now() - new Date(s.dateDeclarationCedante).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const summary = {
      totalSinistres: sapData.length,
      montantTotalSAP: sapData.reduce((s, d) => s + d.sapActuel, 0),
      montantTotalReserves: sapData.reduce((s, d) => s + d.reserves, 0),
      montantRegle: sapData.reduce((s, d) => s + d.montantRegle, 0),
      montantRestant: sapData.reduce((s, d) => s + (d.montantTotal - d.montantRegle), 0),
    };

    return { summary, details: sapData };
  }

  async getMonthlyProduction(filters?: { year?: number; month?: number }) {
    const year = filters?.year || new Date().getFullYear();
    const affaires = await this.affaireRepo.find({ where: { exercice: year }, relations: ['cedante', 'reinsurers'] });

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthAffaires = affaires.filter(a => new Date(a.dateEffet).getMonth() === i);
      return {
        month: new Date(year, i).toLocaleString('fr-FR', { month: 'long' }),
        monthNumber: i + 1,
        affairesCount: monthAffaires.length,
        facultatives: monthAffaires.filter(a => a.category === 'facultative').length,
        traitees: monthAffaires.filter(a => a.category === 'traitee').length,
        primesCedees: monthAffaires.reduce((s, a) => s + Number(a.primeCedee || 0), 0),
        commissionsARS: monthAffaires.reduce((s, a) => s + Number(a.montantCommissionARS || 0), 0),
        commissionsCedante: monthAffaires.reduce((s, a) => s + Number(a.montantCommissionCedante || 0), 0),
      };
    });

    return monthlyData;
  }

  async getCommissionAnalysis(filters?: { startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'] });

    const byCedante = affaires.reduce((acc, a) => {
      const key = a.cedante.id;
      if (!acc[key]) acc[key] = { cedanteName: a.cedante.raisonSociale, commissionCedante: 0, commissionARS: 0, primes: 0 };
      acc[key].commissionCedante += Number(a.montantCommissionCedante || 0);
      acc[key].commissionARS += Number(a.montantCommissionARS || 0);
      acc[key].primes += Number(a.primeCedee || 0);
      return acc;
    }, {} as Record<string, any>);

    Object.values(byCedante).forEach((c: any) => {
      c.tauxCommissionCedante = c.primes > 0 ? (c.commissionCedante / c.primes) * 100 : 0;
      c.tauxCommissionARS = c.primes > 0 ? (c.commissionARS / c.primes) * 100 : 0;
      c.margeNette = c.commissionCedante - c.commissionARS;
    });

    const byBranche = affaires.reduce((acc, a) => {
      const key = a.branche || 'Autres';
      if (!acc[key]) acc[key] = { branche: key, commissionARS: 0, primes: 0 };
      acc[key].commissionARS += Number(a.montantCommissionARS || 0);
      acc[key].primes += Number(a.primeCedee || 0);
      return acc;
    }, {} as Record<string, any>);

    Object.values(byBranche).forEach((b: any) => {
      b.tauxCommission = b.primes > 0 ? (b.commissionARS / b.primes) * 100 : 0;
    });

    return {
      byCedante: Object.values(byCedante).sort((a: any, b: any) => b.commissionARS - a.commissionARS),
      byBranche: Object.values(byBranche).sort((a: any, b: any) => b.commissionARS - a.commissionARS),
      totals: {
        commissionARS: affaires.reduce((s, a) => s + Number(a.montantCommissionARS || 0), 0),
        commissionCedante: affaires.reduce((s, a) => s + Number(a.montantCommissionCedante || 0), 0),
        primes: affaires.reduce((s, a) => s + Number(a.primeCedee || 0), 0),
      },
    };
  }

  async getCedantesPerformance(filters?: { startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante'] });
    const encaissements = await this.encaissementRepo.find({ relations: ['affaire', 'affaire.cedante'] });

    const performance = affaires.reduce((acc, a) => {
      const key = a.cedante.id;
      if (!acc[key]) {
        acc[key] = {
          cedanteName: a.cedante.raisonSociale,
          affairesCount: 0,
          primesCedees: 0,
          primesEncaissees: 0,
          commissionsARS: 0,
          tauxEncaissement: 0,
          delaiMoyenPaiement: 0,
        };
      }
      acc[key].affairesCount++;
      acc[key].primesCedees += Number(a.primeCedee || 0);
      acc[key].primesEncaissees += Number(a.primeEncaissee || 0);
      acc[key].commissionsARS += Number(a.montantCommissionARS || 0);
      return acc;
    }, {} as Record<string, any>);

    Object.values(performance).forEach((p: any) => {
      p.tauxEncaissement = p.primesCedees > 0 ? (p.primesEncaissees / p.primesCedees) * 100 : 0;
      const cedanteEnc = encaissements.filter(e => e.affaire?.cedante?.raisonSociale === p.cedanteName);
      p.delaiMoyenPaiement = cedanteEnc.reduce((sum, e) => {
        const days = Math.floor((new Date(e.dateEncaissement).getTime() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / (cedanteEnc.length || 1);
    });

    return Object.values(performance).sort((a: any, b: any) => b.primesCedees - a.primesCedees);
  }

  async getBranchesAnalysis(filters?: { startDate?: string; endDate?: string }) {
    const affaires = await this.affaireRepo.find();
    const sinistres = await this.sinistreRepo.find({ relations: ['affaire'] });

    const analysis = affaires.reduce((acc, a) => {
      const key = a.branche || 'Autres';
      if (!acc[key]) acc[key] = { branche: key, affairesCount: 0, primes: 0, sinistres: 0, commissions: 0 };
      acc[key].affairesCount++;
      acc[key].primes += Number(a.primeCedee || 0);
      acc[key].commissions += Number(a.montantCommissionARS || 0);
      return acc;
    }, {} as Record<string, any>);

    sinistres.forEach(s => {
      const affaire = affaires.find(a => a.id === s.affaire?.id);
      if (affaire) {
        const key = affaire.branche || 'Autres';
        if (analysis[key]) analysis[key].sinistres += Number(s.montantTotal || 0);
      }
    });

    Object.values(analysis).forEach((a: any) => {
      a.tauxSinistralite = a.primes > 0 ? (a.sinistres / a.primes) * 100 : 0;
      a.tauxCommission = a.primes > 0 ? (a.commissions / a.primes) * 100 : 0;
      a.resultatTechnique = a.primes - a.sinistres - a.commissions;
    });

    return Object.values(analysis).sort((a: any, b: any) => b.primes - a.primes);
  }

  async getPaymentAging(filters?: { type?: string }) {
    const affaires = await this.affaireRepo.find({ relations: ['cedante'] });
    
    const aging = affaires
      .filter(a => a.paymentStatusCedante !== 'complet')
      .map(a => {
        const montantDu = Number(a.primeCedee) - Number(a.primeEncaissee || 0);
        const joursRetard = Math.floor((Date.now() - new Date(a.dateEcheance || a.dateEffet).getTime()) / (1000 * 60 * 60 * 24));
        let bucket = '0-30 jours';
        if (joursRetard > 180) bucket = '+180 jours';
        else if (joursRetard > 90) bucket = '91-180 jours';
        else if (joursRetard > 60) bucket = '61-90 jours';
        else if (joursRetard > 30) bucket = '31-60 jours';

        return {
          affaire: a.numeroAffaire,
          cedante: a.cedante.raisonSociale,
          montantDu,
          joursRetard,
          bucket,
          dateEcheance: a.dateEcheance || a.dateEffet,
          statut: joursRetard > 90 ? 'critique' : joursRetard > 60 ? 'urgent' : joursRetard > 30 ? 'attention' : 'normal',
        };
      });

    const summary = {
      '0-30 jours': aging.filter(a => a.bucket === '0-30 jours').reduce((s, a) => s + a.montantDu, 0),
      '31-60 jours': aging.filter(a => a.bucket === '31-60 jours').reduce((s, a) => s + a.montantDu, 0),
      '61-90 jours': aging.filter(a => a.bucket === '61-90 jours').reduce((s, a) => s + a.montantDu, 0),
      '91-180 jours': aging.filter(a => a.bucket === '91-180 jours').reduce((s, a) => s + a.montantDu, 0),
      '+180 jours': aging.filter(a => a.bucket === '+180 jours').reduce((s, a) => s + a.montantDu, 0),
    };

    return { summary, details: aging };
  }
}
