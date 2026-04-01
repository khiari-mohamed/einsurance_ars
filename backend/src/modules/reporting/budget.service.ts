import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';

export interface BudgetData {
  year: number;
  budgetByCedant: Record<string, number>;
  budgetByReassureur: Record<string, number>;
  budgetByBranch: Record<string, number>;
  totalBudget: number;
}

export interface ActualData {
  totalRevenue: number;
  revenueByCedant: Record<string, number>;
  revenueByReassureur: Record<string, number>;
  revenueByBranch: Record<string, number>;
}

@Injectable()
export class BudgetService {
  private budgets: Map<number, BudgetData> = new Map();

  constructor(
    @InjectRepository(Affaire)
    private affaireRepository: Repository<Affaire>,
  ) {}

  async saveBudget(year: number, budgetData: Partial<BudgetData>): Promise<BudgetData> {
    const budget: BudgetData = {
      year,
      budgetByCedant: budgetData.budgetByCedant || {},
      budgetByReassureur: budgetData.budgetByReassureur || {},
      budgetByBranch: budgetData.budgetByBranch || {},
      totalBudget: budgetData.totalBudget || 0,
    };

    this.budgets.set(year, budget);
    return budget;
  }

  async getBudget(year: number): Promise<BudgetData> {
    return this.budgets.get(year) || {
      year,
      budgetByCedant: {},
      budgetByReassureur: {},
      budgetByBranch: {},
      totalBudget: 0,
    };
  }

  async getActual(year: number): Promise<ActualData> {
    const affaires = await this.affaireRepository
      .createQueryBuilder('affaire')
      .leftJoinAndSelect('affaire.cedante', 'cedante')
      .leftJoinAndSelect('affaire.reinsurers', 'reinsurers')
      .leftJoinAndSelect('reinsurers.reassureur', 'reassureur')
      .where('affaire.exercice = :year', { year })
      .andWhere('affaire.status IN (:...statuses)', { statuses: ['placement_realise', 'active'] })
      .getMany();

    const revenueByCedant: Record<string, number> = {};
    const revenueByReassureur: Record<string, number> = {};
    const revenueByBranch: Record<string, number> = {};
    let totalRevenue = 0;

    for (const affaire of affaires) {
      const commission = Number(affaire.montantCommissionARS);
      totalRevenue += commission;

      // By Cedant
      const cedanteName = affaire.cedante?.raisonSociale || 'Unknown';
      revenueByCedant[cedanteName] = (revenueByCedant[cedanteName] || 0) + commission;

      // By Branch
      const branche = affaire.branche || 'Other';
      revenueByBranch[branche] = (revenueByBranch[branche] || 0) + commission;

      // By Reinsurer (proportional to their share)
      for (const reinsurerPart of affaire.reinsurers || []) {
        const reassureurName = reinsurerPart.reassureur?.raisonSociale || 'Unknown';
        const share = Number(reinsurerPart.share) / 100;
        const revenueShare = commission * share;
        revenueByReassureur[reassureurName] = (revenueByReassureur[reassureurName] || 0) + revenueShare;
      }
    }

    return {
      totalRevenue,
      revenueByCedant,
      revenueByReassureur,
      revenueByBranch,
    };
  }

  async getVarianceAnalysis(year: number): Promise<any> {
    const budget = await this.getBudget(year);
    const actual = await this.getActual(year);

    const calculateVariance = (actual: number, budget: number) => {
      if (budget === 0) return 0;
      return ((actual - budget) / budget) * 100;
    };

    return {
      year,
      overall: {
        budget: budget.totalBudget,
        actual: actual.totalRevenue,
        variance: calculateVariance(actual.totalRevenue, budget.totalBudget),
        achievement: budget.totalBudget > 0 ? (actual.totalRevenue / budget.totalBudget) * 100 : 0,
      },
      byCedant: Object.keys({ ...budget.budgetByCedant, ...actual.revenueByCedant }).map(cedant => ({
        cedant,
        budget: budget.budgetByCedant[cedant] || 0,
        actual: actual.revenueByCedant[cedant] || 0,
        variance: calculateVariance(actual.revenueByCedant[cedant] || 0, budget.budgetByCedant[cedant] || 0),
      })),
      byBranch: Object.keys({ ...budget.budgetByBranch, ...actual.revenueByBranch }).map(branch => ({
        branch,
        budget: budget.budgetByBranch[branch] || 0,
        actual: actual.revenueByBranch[branch] || 0,
        variance: calculateVariance(actual.revenueByBranch[branch] || 0, budget.budgetByBranch[branch] || 0),
      })),
    };
  }

  async getQuarterlyReport(year: number, quarter: number): Promise<any> {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    const affaires = await this.affaireRepository
      .createQueryBuilder('affaire')
      .leftJoinAndSelect('affaire.cedante', 'cedante')
      .where('affaire.exercice = :year', { year })
      .andWhere('EXTRACT(MONTH FROM affaire.dateEffet) BETWEEN :startMonth AND :endMonth', { startMonth, endMonth })
      .andWhere('affaire.status IN (:...statuses)', { statuses: ['placement_realise', 'active'] })
      .getMany();

    const totalRevenue = affaires.reduce((sum, a) => sum + Number(a.montantCommissionARS), 0);
    const dealCount = affaires.length;

    return {
      year,
      quarter,
      period: `Q${quarter} ${year}`,
      totalRevenue,
      dealCount,
      averageCommission: dealCount > 0 ? totalRevenue / dealCount : 0,
      deals: affaires.map(a => ({
        numeroAffaire: a.numeroAffaire,
        cedante: a.cedante?.raisonSociale,
        commission: a.montantCommissionARS,
        dateEffet: a.dateEffet,
      })),
    };
  }
}
