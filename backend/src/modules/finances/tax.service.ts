import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Commission, CommissionType } from './commission.entity';
import { Decaissement } from './decaissement.entity';
import { AuditLog } from './audit-log.entity';

export interface TaxCalculation {
  montantHT: number;
  tauxTVA: number;
  montantTVA: number;
  montantTTC: number;
  withholding?: number;
  taxType: 'TVA' | 'WITHHOLDING' | 'BOTH' | 'NONE';
}

@Injectable()
export class TaxService {
  // Tunisian tax configuration
  private readonly TVA_RATE = 0.19; // 19% standard rate
  private readonly TVA_REDUCED_RATE = 0.07; // 7% reduced rate
  private readonly WITHHOLDING_RATE = 0.10; // 10% withholding on payments
  private readonly PROFESSIONAL_WITHHOLDING = 0.20; // 20% for non-registered professionals

  constructor(
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Calculate TVA on commission
   */
  calculateTVA(commissionAmount: number, isReduced: boolean = false): TaxCalculation {
    const tvaRate = isReduced ? this.TVA_REDUCED_RATE : this.TVA_RATE;
    const tvaAmount = commissionAmount * tvaRate;
    const ttcAmount = commissionAmount + tvaAmount;

    return {
      montantHT: commissionAmount,
      tauxTVA: tvaRate,
      montantTVA: tvaAmount,
      montantTTC: ttcAmount,
      taxType: 'TVA',
    };
  }

  /**
   * Calculate withholding tax on payment
   */
  calculateWithholding(paymentAmount: number, isRegisteredProfessional: boolean = true): TaxCalculation {
    const holdingRate = isRegisteredProfessional ? this.WITHHOLDING_RATE : this.PROFESSIONAL_WITHHOLDING;
    const witholdingAmount = paymentAmount * holdingRate;
    const netAmount = paymentAmount - witholdingAmount;

    return {
      montantHT: paymentAmount,
      tauxTVA: holdingRate,
      montantTVA: witholdingAmount,
      montantTTC: netAmount,
      withholding: witholdingAmount,
      taxType: 'WITHHOLDING',
    };
  }

  /**
   * Calculate both TVA and withholding
   */
  calculateCombined(amount: number, includeVTA: boolean = true, includeWithholding: boolean = true): TaxCalculation {
    let running = amount;
    let totalTax = 0;

    if (includeVTA) {
      const vta = running * this.TVA_RATE;
      totalTax += vta;
      running += vta;
    }

    if (includeWithholding) {
      const withholding = running * this.WITHHOLDING_RATE;
      totalTax -= withholding;
    }

    return {
      montantHT: amount,
      tauxTVA: this.TVA_RATE,
      montantTVA: totalTax,
      montantTTC: amount + totalTax,
      taxType: includeVTA && includeWithholding ? 'BOTH' : includeVTA ? 'TVA' : 'WITHHOLDING',
    };
  }

  /**
   * Get tax obligation for commission
   */
  async getCommissionTaxObligation(
    startDate: string,
    endDate: string,
    commissionType: CommissionType,
  ): Promise<any> {
    const commissions = await this.commissionRepo.find({
      where: {
        type: commissionType,
        dateCalcul: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.montant), 0);
    const tvaCalculation = this.calculateTVA(totalCommissions);

    return {
      periode: { startDate, endDate },
      commissionType,
      totalCommissions,
      tva: tvaCalculation.montantTVA,
      totalWithTax: tvaCalculation.montantTTC,
      commissionDetails: commissions,
      taxDeductible: commissionType === CommissionType.ARS,
    };
  }

  /**
   * Get withholding tax report
   */
  async getWithholdingTaxReport(startDate: string, endDate: string): Promise<any> {
    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(new Date(startDate), new Date(endDate)),
      },
      relations: ['reassureur', 'cedante'],
    });

    const withholdingByBeneficiary = {};
    let totalWithholding = 0;

    for (const dec of decaissements) {
      const beneficiaryName = dec.reassureur?.raisonSociale || dec.cedante?.raisonSociale || 'Unknown';
      const withholding = Number(dec.montant) * this.WITHHOLDING_RATE;

      if (!withholdingByBeneficiary[beneficiaryName]) {
        withholdingByBeneficiary[beneficiaryName] = {
          totalPayments: 0,
          withholdingAmount: 0,
          paymentCount: 0,
        };
      }

      withholdingByBeneficiary[beneficiaryName].totalPayments += Number(dec.montant);
      withholdingByBeneficiary[beneficiaryName].withholdingAmount += withholding;
      withholdingByBeneficiary[beneficiaryName].paymentCount += 1;
      totalWithholding += withholding;
    }

    return {
      periode: { startDate, endDate },
      totalPayments: decaissements.reduce((sum, d) => sum + Number(d.montant), 0),
      totalWithholding,
      byBeneficiary: withholdingByBeneficiary,
      reportingDeadline: this.getWithholdingReportingDeadline(),
      notes: 'Withholding tax must be paid to Tunisian tax authority by 15th of following month',
    };
  }

  /**
   * Calculate tax deductions for the year
   */
  async getTaxDeductions(year: number): Promise<any> {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const commissions = await this.commissionRepo.find({
      where: {
        type: CommissionType.ARS,
        dateCalcul: Between(startDate, endDate),
      },
    });

    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(startDate, endDate),
      },
    });

    const deductibleItems = {
      commissionARS: 0,
      bankFees: 0,
      otherExpenses: 0,
    };

    commissions.forEach(c => {
      deductibleItems.commissionARS += Number(c.montant);
    });

    decaissements.forEach(d => {
      deductibleItems.bankFees += Number(d.fraisBancaires);
    });

    const totalDeductible = Object.values(deductibleItems).reduce((sum: number, val) => sum + val, 0);
    const potentialTaxSavings = totalDeductible * this.TVA_RATE;

    return {
      year,
      deductibleItems,
      totalDeductible,
      estimatedTaxSavings: potentialTaxSavings,
      recommendation: `Review deductions and ensure proper documentation for tax filing`,
    };
  }

  /**
   * Tax compliance checklist
   */
  async getTaxComplianceStatus(): Promise<any> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    const monthlyPayments = await this.decaissementRepo.count({
      where: {
        dateDecaissement: Between(startOfMonth, endOfMonth),
      },
    });

    const monthlyWithholding = await this.getWithholdingTaxReport(
      startOfMonth.toISOString().split('T')[0],
      endOfMonth.toISOString().split('T')[0],
    );

    return {
      currentPeriod: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      checks: {
        withholding_calculated: monthlyWithholding.totalWithholding > 0,
        withholding_deadline: currentMonth === now.getMonth() + 2 ? 'DUE_SOON' : 'ON_TRACK',
        monthly_declarations: monthlyPayments > 0,
        vat_reconciliation: 'PENDING',
      },
      actions_needed: [
        monthlyWithholding.totalWithholding > 0 ? 'File monthly withholding tax return' : null,
        monthlyPayments > 10 ? 'Reconcile monthly payments with bank' : null,
      ].filter(Boolean),
      next_deadline: this.getNextTaxDeadline(),
    };
  }

  /**
   * Generate IBS (Impôt sur les Bénéfices) calculation
   */
  async calculateIBS(startDate: string, endDate: string, corporateRate: number = 0.15): Promise<any> {
    const commissions = await this.commissionRepo.find({
      where: {
        type: CommissionType.ARS,
        dateCalcul: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const totalRevenue = commissions.reduce((sum, c) => sum + Number(c.montant), 0);
    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const totalExpenses = decaissements.reduce((sum, d) => sum + Number(d.fraisBancaires), 0);
    const taxableIncome = totalRevenue - totalExpenses;
    const ibsAmount = taxableIncome * corporateRate;

    return {
      periode: { startDate, endDate },
      totalRevenue,
      totalExpenses,
      taxableIncome,
      corporateRate: (corporateRate * 100).toFixed(1) + '%',
      ibsAmount,
      estimatedPayment: (ibsAmount / 4).toFixed(2), // Quarterly payment
      paymentSchedule: this.getIBSPaymentSchedule(),
    };
  }

  // ==================== UTILITIES ====================

  private getWithholdingReportingDeadline(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return nextMonth.toISOString().split('T')[0];
  }

  private getNextTaxDeadline(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return nextMonth.toLocaleDateString('fr-TN');
  }

  private getIBSPaymentSchedule(): any[] {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { quarter: 'Q1', dueDate: `${year}-04-30` },
      { quarter: 'Q2', dueDate: `${year}-07-31` },
      { quarter: 'Q3', dueDate: `${year}-10-31` },
      { quarter: 'Q4', dueDate: `${year + 1}-03-31` },
    ];
  }
}
