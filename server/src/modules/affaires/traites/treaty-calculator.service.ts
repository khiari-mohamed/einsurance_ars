import { Injectable } from '@nestjs/common';
import { CommissionMode, Periodicite } from '@prisma/client';

// ── Input / Output types ─────────────────────────────────────────

export interface PmdInstalmentResult {
  numeroTranche: number;
  dateEcheance: Date;
  montantBrut: number;   // tranche amount before deduction
  tauxDeduction: number; // %
  montantNet: number;    // what gets paid
}

export interface TreatyDistributionInput {
  primeNetteCedante: number; // prime cédée net of cedante commission
  reassureurs: Array<{
    reassureurId: string;
    partPct: number;
    commissionMode: CommissionMode;
    tauxCommissionArs: number; // % (0–100)
    commissionForfait?: number;
  }>;
}

export interface TreatyDistributionResult {
  reassureurId: string;
  primeBrute: number;          // partPct × primeNetteCedante / 100
  commissionArs: number;       // brokerage earned by ARS
  primeNetteReassureur: number; // what gets wired to reinsurer
}

export interface LiquidationInput {
  // DEBIT side (Cedante sends)
  primesCedees: number;
  participationsBenefReçues: number;
  interetsSurDepots: number;
  // CREDIT side (ARS sends / reinsurer receives)
  sinistresPayes: number;
  reservesConstituees: number; // SAP
  reservesLibereesAnterieur: number;
  commissionCedante: number;
  commissionLiquidationArs: number;
  courtage: number;
  taxes: number;
  pmdDeductible: number; // PMD already paid to deduct
}

export interface LiquidationResult {
  totalDebit: number;
  totalCredit: number;
  soldeNet: number; // positive = cedante owes ARS; negative = ARS owes reinsurers
  soldeDirection: 'CEDANTE_DOIT' | 'ARS_DOIT' | 'EQUILIBRE';
  lines: Array<{ libelle: string; debit: number; credit: number }>;
}

export interface XolPremiumInput {
  primeSujet: number;       // 100% subject premium
  tauxPmd: number;          // % deposit rate
  tauxReconstitution: number; // % reconstitution rate per event
  nombreEvenements: number;   // how many losses occurred
  pmdDejaPayee: number;       // already paid deposit
}

export interface XolPremiumResult {
  depositPremium: number;
  reconstitutionPremium: number;
  totalPremium: number;
  ajustement: number; // positive = additional due; negative = refund
}

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class TreatyCalculatorService {
  /**
   * Generate a PMD instalment schedule from a total PMD amount
   * and a payment frequency. If custom instalments are provided
   * they override the auto-generated ones.
   */
  generatePmdInstalments(
    pmd: number,
    periodicite: Periodicite,
    dateEffet: Date,
    tauxDeduction = 0,
  ): PmdInstalmentResult[] {
    const tranchesCount = this.tranchesFromPeriodicite(periodicite);
    const montantBrut = this.round3(pmd / tranchesCount);
    const results: PmdInstalmentResult[] = [];

    for (let i = 1; i <= tranchesCount; i++) {
      const dateEcheance = this.addMonths(
        dateEffet,
        (i - 1) * (12 / tranchesCount),
      );
      const montantNet = tauxDeduction
        ? this.round3(montantBrut * (1 - tauxDeduction / 100))
        : montantBrut;

      results.push({
        numeroTranche: i,
        dateEcheance,
        montantBrut,
        tauxDeduction,
        montantNet,
      });
    }

    return results;
  }

  /**
   * Distribute a proportional treaty net premium across reinsurers
   * according to their participation percentages and ARS commission mode.
   */
  calculateTreatyDistribution(
    input: TreatyDistributionInput,
  ): TreatyDistributionResult[] {
    return input.reassureurs.map((r) => {
      const primeBrute = this.round3(
        input.primeNetteCedante * (r.partPct / 100),
      );

      let commissionArs: number;
      if (r.commissionMode === CommissionMode.FORFAITAIRE) {
        commissionArs = r.commissionForfait ?? 0;
      } else {
        commissionArs = this.round3(primeBrute * (r.tauxCommissionArs / 100));
      }

      const primeNetteReassureur = this.round3(primeBrute - commissionArs);

      return {
        reassureurId: r.reassureurId,
        primeBrute,
        commissionArs,
        primeNetteReassureur,
      };
    });
  }

  /**
   * Compute the treaty liquidation account (compte d'exploitation).
   * Returns debit/credit totals and the netting direction.
   */
  calculateLiquidation(input: LiquidationInput): LiquidationResult {
    const lines: Array<{ libelle: string; debit: number; credit: number }> = [
      // ── DEBIT SIDE ────────────────────────────────────────────
      {
        libelle: 'Primes cédées',
        debit: input.primesCedees,
        credit: 0,
      },
      {
        libelle: 'Participations bénéficiaires reçues',
        debit: input.participationsBenefReçues,
        credit: 0,
      },
      {
        libelle: 'Intérêts sur dépôts',
        debit: input.interetsSurDepots,
        credit: 0,
      },
      {
        libelle: 'PMD déductible',
        debit: input.pmdDeductible,
        credit: 0,
      },

      // ── CREDIT SIDE ───────────────────────────────────────────
      {
        libelle: 'Sinistres payés (part réassureurs)',
        debit: 0,
        credit: input.sinistresPayes,
      },
      {
        libelle: 'Réserves constituées (SAP)',
        debit: 0,
        credit: input.reservesConstituees,
      },
      {
        libelle: 'Réserves libérées antérieures',
        debit: input.reservesLibereesAnterieur,
        credit: 0,
      },
      {
        libelle: 'Commission cédante',
        debit: 0,
        credit: input.commissionCedante,
      },
      {
        libelle: 'Commission liquidation ARS',
        debit: 0,
        credit: input.commissionLiquidationArs,
      },
      {
        libelle: 'Courtage',
        debit: 0,
        credit: input.courtage,
      },
      {
        libelle: 'Taxes',
        debit: 0,
        credit: input.taxes,
      },
    ].filter((l) => l.debit > 0 || l.credit > 0);

    const totalDebit = this.round3(
      lines.reduce((s, l) => s + l.debit, 0),
    );
    const totalCredit = this.round3(
      lines.reduce((s, l) => s + l.credit, 0),
    );
    const soldeNet = this.round3(totalDebit - totalCredit);

    let soldeDirection: LiquidationResult['soldeDirection'];
    if (Math.abs(soldeNet) < 0.001) {
      soldeDirection = 'EQUILIBRE';
    } else if (soldeNet > 0) {
      // More debit than credit → cedante owes ARS → ARS collects
      soldeDirection = 'CEDANTE_DOIT';
    } else {
      // More credit than debit → ARS owes reinsurers
      soldeDirection = 'ARS_DOIT';
    }

    return { totalDebit, totalCredit, soldeNet, soldeDirection, lines };
  }

  /**
   * Calculate XOL non-proportional deposit premium and reconstitution.
   */
  calculateXolPremium(input: XolPremiumInput): XolPremiumResult {
    const depositPremium = this.round3(
      input.primeSujet * (input.tauxPmd / 100),
    );
    const reconstitutionPremium = this.round3(
      depositPremium * (input.tauxReconstitution / 100) * input.nombreEvenements,
    );
    const totalPremium = this.round3(depositPremium + reconstitutionPremium);
    const ajustement = this.round3(totalPremium - input.pmdDejaPayee);

    return {
      depositPremium,
      reconstitutionPremium,
      totalPremium,
      ajustement,
    };
  }

  /**
   * Calculate pro-rata premium for partial year coverage.
   * Used when a treaty starts or ends mid-year.
   */
  calculateProRata(annualPremium: number, dateEffet: Date, dateEcheance: Date): number {
    const msYear = 365.25 * 24 * 60 * 60 * 1000;
    const msCoverage = dateEcheance.getTime() - dateEffet.getTime();
    const ratio = msCoverage / msYear;
    return this.round3(annualPremium * Math.min(ratio, 1));
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private tranchesFromPeriodicite(p: Periodicite): number {
    switch (p) {
      case Periodicite.TRIMESTRIELLE:
        return 4;
      case Periodicite.SEMESTRIELLE:
        return 2;
      case Periodicite.ANNUELLE:
        return 1;
      default:
        return 4;
    }
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + Math.round(months));
    return d;
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}