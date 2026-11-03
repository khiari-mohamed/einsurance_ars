import { Injectable, BadRequestException } from '@nestjs/common';
import { CommissionMode } from '@prisma/client';

export interface CommissionInput {
  /** Legacy affaire-level premium, used when a line has no own premium. */
  prime100Pct: number;
  /** Legacy affaire-level cedante rate, used when a line has no own rate. */
  tauxCommissionCedante?: number;
  reassureurs: {
    reassureurId: string;
    prime100Pct?: number;
    tauxCommissionCedante?: number;
    /** Part placée — % of the 100% premium (facultative) */
    partPct: number;
    commissionMode: CommissionMode;
    /** ARS commission (courtage) rate, % (0–100) */
    tauxCommissionArs?: number;
    commissionForfait?: number;
  }[];
}

export interface CommissionResult {
  reassureurId: string;
  primeBrute: number;            // prime cédée share = prime100 × part%
  commissionArs: number;         // rému ARS (courtage)
  commissionCedante: number;     // rému cédante
  primeNetteCedante: number;     // primeBrute − commissionCedante
  primeNetteReassureur: number;  // primeBrute − commissionCedante − commissionArs
}

export interface NonProportionalLineInput {
  priorite: number;
  pmd: number;
  portee: number;
  epi: number;
  tauxPrime: number;
  tauxCommissionCedante?: number;
  tauxCommissionArs?: number;
}

export interface NonProportionalLineResult extends NonProportionalLineInput {
  primeAnnuelle: number;
  commissionCedante: number;
  commissionArs: number;
  primeNette: number;
}

@Injectable()
export class CommissionCalculatorService {
  /**
   * Client definitions (email "Avancement App Réass"):
   *  prime cédée        = part × prime@100%
   *  rému cédante       = prime cédée × taux com cédante
   *  rému ARS           = prime cédée × taux com ARS
   *  prime nette cédante    = prime cédée − com cédante
   *  prime nette réassureur = prime cédée − com cédante − com courtage
   * Intermediates stay unrounded; each output is rounded to 3 decimals once.
   */
  calculate(input: CommissionInput): CommissionResult[] {
    return input.reassureurs.map((r) => {
      const prime100 = r.prime100Pct ?? input.prime100Pct;
      const prime = prime100 * (r.partPct / 100);
      const commissionCedante = prime * ((r.tauxCommissionCedante ?? input.tauxCommissionCedante ?? 0) / 100);
      const commissionArs =
        r.commissionMode === CommissionMode.FORFAITAIRE
          ? r.commissionForfait ?? 0
          : prime * ((r.tauxCommissionArs ?? 0) / 100);

      return {
        reassureurId: r.reassureurId,
        primeBrute: this.round3(prime),
        commissionArs: this.round3(commissionArs),
        commissionCedante: this.round3(commissionCedante),
        primeNetteCedante: this.round3(prime - commissionCedante),
        primeNetteReassureur: this.round3(prime - commissionCedante - commissionArs),
      };
    });
  }

  /**
   * Validate that the shares total `expectedTotal`.
   * Facultative: expectedTotal = tauxCession. Treaty: 100 (default).
   */
  validateShares(reassureurs: { partPct: number }[], expectedTotal = 100): void {
    const total = reassureurs.reduce((sum, r) => sum + Number(r.partPct), 0);
    if (Math.abs(total - expectedTotal) > 0.001) {
      throw new BadRequestException(
        `La somme des participations doit être égale à ${expectedTotal.toFixed(4)}% (actuel: ${total.toFixed(4)}%)`,
      );
    }
  }

  calculateNonProportionalLine(input: NonProportionalLineInput): NonProportionalLineResult {
    const primeAnnuelle = input.epi * (input.tauxPrime / 100);
    const commissionCedante = primeAnnuelle * ((input.tauxCommissionCedante ?? 0) / 100);
    const commissionArs = primeAnnuelle * ((input.tauxCommissionArs ?? 0) / 100);
    return {
      ...input,
      primeAnnuelle: this.round3(primeAnnuelle),
      commissionCedante: this.round3(commissionCedante),
      commissionArs: this.round3(commissionArs),
      primeNette: this.round3(primeAnnuelle - commissionCedante - commissionArs),
    };
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}