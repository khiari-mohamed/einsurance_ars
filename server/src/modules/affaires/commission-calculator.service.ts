import { Injectable, BadRequestException } from '@nestjs/common';
import { CommissionMode } from '@prisma/client';

export interface CommissionInput {
  /** Prime à 100% — NOT rounded. Base for every per-reinsurer figure. */
  prime100Pct: number;
  /** Cedante commission rate, % (0–100) */
  tauxCommissionCedante: number;
  reassureurs: {
    reassureurId: string;
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
      const prime = input.prime100Pct * (r.partPct / 100);
      const commissionCedante = prime * (input.tauxCommissionCedante / 100);
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

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}