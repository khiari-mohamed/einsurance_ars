import { Injectable } from '@nestjs/common';
import { CommissionMode } from '@prisma/client';

export interface CommissionInput {
  primeCedee: number;          // total ceded premium (100% before reinsurer split)
  tauxCession: number;         // cession rate (% as decimal 0–1)
  tauxCommissionCedante: number; // cedante commission rate
  reassureurs: {
    reassureurId: string;
    partPct: number;           // reinsurer share % as decimal 0–100
    commissionMode: CommissionMode;
    tauxCommissionArs?: number; // % as decimal 0–100
    commissionForfait?: number;
  }[];
}

export interface CommissionResult {
  reassureurId: string;
  primeBrute: number;          // partPct × primeCedee / 100
  commissionArs: number;       // ARS brokerage on this share
  commissionCedante: number;   // cedante commission on this share
  primeNetteCedante: number;   // primeBrute - commissionCedante
  primeNetteReassureur: number; // primeBrute - commissionArs - commissionCedante
}

@Injectable()
export class CommissionCalculatorService {
  calculate(input: CommissionInput): CommissionResult[] {
    const results: CommissionResult[] = [];

    for (const r of input.reassureurs) {
      // Reinsurer's share of the ceded premium
      const primeBrute = this.round3(input.primeCedee * (r.partPct / 100));

      // ARS commission (brokerage)
      let commissionArs: number;
      if (r.commissionMode === CommissionMode.FORFAITAIRE) {
        commissionArs = r.commissionForfait ?? 0;
      } else {
        // CALCULABLE: tauxCommissionArs × primeBrute
        commissionArs = this.round3(primeBrute * ((r.tauxCommissionArs ?? 0) / 100));
      }

      // Cedante commission on this reinsurer's share
      const commissionCedante = this.round3(primeBrute * (input.tauxCommissionCedante / 100));

      // Net receivable from cedante on this share (= what cedante actually pays ARS net)
      const primeNetteCedante = this.round3(primeBrute - commissionCedante);

      // Net payable to reinsurer (= what ARS wires to reinsurer)
      const primeNetteReassureur = this.round3(primeBrute - commissionArs - commissionCedante);

      results.push({
        reassureurId: r.reassureurId,
        primeBrute,
        commissionArs,
        commissionCedante,
        primeNetteCedante,
        primeNetteReassureur,
      });
    }

    return results;
  }

  /** Validate reinsurer shares sum to 100% */
  validateShares(reassureurs: { partPct: number }[]): void {
    const total = reassureurs.reduce((sum, r) => sum + r.partPct, 0);
    const diff = Math.abs(total - 100);
    if (diff > 0.001) {
      throw new Error(`La somme des participations doit être 100% (actuel: ${total.toFixed(4)}%)`);
    }
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}