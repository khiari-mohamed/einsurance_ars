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
  calculateLiquidation(input: LiquidationInput): LiquidationResult {
    const lines: Array<{ libelle: string; debit: number; credit: number }> = [
      // ── DEBIT SIDE (per CDC §8.3 / BordereauLine) ──────────────
      {
        libelle: 'Sinistres payés (part réassureurs)',
        debit: input.sinistresPayes,
        credit: 0,
      },
      {
        libelle: 'Réserves constituées (SAP)',
        debit: input.reservesConstituees,
        credit: 0,
      },
      {
        libelle: 'Commission cédante',
        debit: input.commissionCedante,
        credit: 0,
      },
      {
        libelle: 'Commission liquidation ARS',
        debit: input.commissionLiquidationArs,
        credit: 0,
      },
      {
        libelle: 'Courtage',
        debit: input.courtage,
        credit: 0,
      },
      {
        libelle: 'Taxes',
        debit: input.taxes,
        credit: 0,
      },

      // ── CREDIT SIDE (per CDC §8.3 / BordereauLine) ─────────────
      {
        libelle: 'Primes cédées',
        debit: 0,
        credit: input.primesCedees,
      },
      {
        libelle: 'Réserves libérées antérieures',
        debit: 0,
        credit: input.reservesLibereesAnterieur,
      },
      {
        libelle: 'Participations bénéficiaires reçues',
        debit: 0,
        credit: input.participationsBenefReçues,
      },
      {
        libelle: 'Intérêts sur dépôts',
        debit: 0,
        credit: input.interetsSurDepots,
      },
      {
        libelle: 'PMD déductible',
        debit: 0,
        credit: input.pmdDeductible,
      },
    ].filter((l) => l.debit > 0 || l.credit > 0);

    const totalDebit = this.round3(
      lines.reduce((s, l) => s + l.debit, 0),
    );
    const totalCredit = this.round3(
      lines.reduce((s, l) => s + l.credit, 0),
    );
    const soldeNet = this.round3(totalCredit - totalDebit);

    let soldeDirection: LiquidationResult['soldeDirection'];
    if (Math.abs(soldeNet) < 0.001) {
      soldeDirection = 'EQUILIBRE';
    } else if (soldeNet > 0) {
      // More credit than debit → cedante owes ARS → ARS collects
      soldeDirection = 'CEDANTE_DOIT';
    } else {
      // More debit than credit → ARS owes reinsurers
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