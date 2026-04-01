import { Injectable, BadRequestException } from '@nestjs/common';
import { TreatyType } from '../affaires/affaires.entity';

@Injectable()
export class TreatyCalculatorService {
  /**
   * Calculate PMD (Prime Minimum de Dépôt) for treaty
   */
  calculatePMD(
    primePrevisionnelle: number,
    treatyType: TreatyType,
    tauxPMD: number = 25, // Default 25%
  ): number {
    if (primePrevisionnelle <= 0) {
      throw new BadRequestException('Prime prévisionnelle must be positive');
    }

    if (tauxPMD < 0 || tauxPMD > 100) {
      throw new BadRequestException('Taux PMD must be between 0 and 100');
    }

    return Number(((primePrevisionnelle * tauxPMD) / 100).toFixed(2));
  }

  /**
   * Calculate QP (Quote Part) treaty share
   */
  calculateQPShare(
    capitalAssure: number,
    tauxCession: number,
    pleinConservation: number,
  ): { capitalCede: number; primeCedee: number; tauxEffectif: number } {
    if (capitalAssure <= 0) throw new BadRequestException('Capital must be positive');
    if (tauxCession < 0 || tauxCession > 100) throw new BadRequestException('Invalid cession rate');

    const capitalCede = (capitalAssure * tauxCession) / 100;
    const tauxEffectif = pleinConservation > 0 
      ? Math.min(tauxCession, (capitalCede / pleinConservation) * 100)
      : tauxCession;

    return {
      capitalCede: Number(capitalCede.toFixed(2)),
      primeCedee: Number(capitalCede.toFixed(2)), // Simplified
      tauxEffectif: Number(tauxEffectif.toFixed(2)),
    };
  }

  /**
   * Calculate XOL (Excess of Loss) premium
   */
  calculateXOLPremium(
    portee: number, // Coverage amount
    franchise: number, // Deductible
    tauxPrime: number, // Rate on line
    nombreReinstatements: number = 1,
  ): { primeBase: number; primeReinstatements: number; primeTotal: number } {
    if (portee <= 0) throw new BadRequestException('Portée must be positive');
    if (franchise < 0) throw new BadRequestException('Franchise cannot be negative');
    if (tauxPrime <= 0) throw new BadRequestException('Taux prime must be positive');

    const primeBase = (portee * tauxPrime) / 100;
    const primeReinstatements = primeBase * nombreReinstatements * 0.5; // 50% for reinstatements
    const primeTotal = primeBase + primeReinstatements;

    return {
      primeBase: Number(primeBase.toFixed(2)),
      primeReinstatements: Number(primeReinstatements.toFixed(2)),
      primeTotal: Number(primeTotal.toFixed(2)),
    };
  }

  /**
   * Calculate Surplus treaty capacity
   */
  calculateSurplusCapacity(
    pleinConservation: number,
    nombrePleins: number,
    capitalAssure: number,
  ): { capaciteTotale: number; partCedee: number; partConservee: number; tauxCession: number } {
    if (pleinConservation <= 0) throw new BadRequestException('Plein conservation must be positive');
    if (nombrePleins <= 0) throw new BadRequestException('Nombre de pleins must be positive');

    const capaciteTotale = pleinConservation * (1 + nombrePleins);
    const partConservee = Math.min(capitalAssure, pleinConservation);
    const partCedee = Math.max(0, Math.min(capitalAssure - pleinConservation, pleinConservation * nombrePleins));
    const tauxCession = capitalAssure > 0 ? (partCedee / capitalAssure) * 100 : 0;

    return {
      capaciteTotale: Number(capaciteTotale.toFixed(2)),
      partCedee: Number(partCedee.toFixed(2)),
      partConservee: Number(partConservee.toFixed(2)),
      tauxCession: Number(tauxCession.toFixed(2)),
    };
  }

  /**
   * Calculate Stop Loss premium
   */
  calculateStopLossPremium(
    assiettePrimes: number, // Premium base
    tauxPrioritaire: number, // Retention rate (e.g., 70%)
    tauxPortee: number, // Coverage rate (e.g., 30%)
    tauxPrime: number, // Premium rate
  ): { priorite: number; portee: number; prime: number } {
    if (assiettePrimes <= 0) throw new BadRequestException('Assiette must be positive');
    if (tauxPrioritaire < 0 || tauxPrioritaire > 100) throw new BadRequestException('Invalid retention rate');
    if (tauxPortee < 0 || tauxPortee > 100) throw new BadRequestException('Invalid coverage rate');

    const priorite = (assiettePrimes * tauxPrioritaire) / 100;
    const portee = (assiettePrimes * tauxPortee) / 100;
    const prime = (portee * tauxPrime) / 100;

    return {
      priorite: Number(priorite.toFixed(2)),
      portee: Number(portee.toFixed(2)),
      prime: Number(prime.toFixed(2)),
    };
  }

  /**
   * Calculate periodic settlement amount for treaty
   */
  calculatePeriodicSettlement(
    primePrevisionnelle: number,
    primeEmise: number,
    sinistres: number,
    commissions: number,
    pmdVerse: number,
    periodicite: 'trimestriel' | 'semestriel' | 'annuel',
  ): { primeAjustee: number; sinistresPart: number; commissionsPart: number; solde: number; ajustementPMD: number } {
    // Calculate prorata based on period
    let prorata = 1;
    if (periodicite === 'trimestriel') prorata = 0.25;
    else if (periodicite === 'semestriel') prorata = 0.5;

    const primeAjustee = primeEmise > 0 ? primeEmise : primePrevisionnelle * prorata;
    const sinistresPart = sinistres;
    const commissionsPart = commissions;
    const ajustementPMD = pmdVerse;
    const solde = primeAjustee - sinistresPart - commissionsPart - ajustementPMD;

    return {
      primeAjustee: Number(primeAjustee.toFixed(2)),
      sinistresPart: Number(sinistresPart.toFixed(2)),
      commissionsPart: Number(commissionsPart.toFixed(2)),
      solde: Number(solde.toFixed(2)),
      ajustementPMD: Number(ajustementPMD.toFixed(2)),
    };
  }

  /**
   * Calculate treaty commission based on loss ratio
   */
  calculateSlidingScaleCommission(
    primes: number,
    sinistres: number,
    commissionMin: number,
    commissionMax: number,
    lossRatioMin: number = 50,
    lossRatioMax: number = 70,
  ): { lossRatio: number; commission: number; tauxCommission: number } {
    if (primes <= 0) return { lossRatio: 0, commission: 0, tauxCommission: 0 };

    const lossRatio = (sinistres / primes) * 100;
    
    let tauxCommission: number;
    if (lossRatio <= lossRatioMin) {
      tauxCommission = commissionMax;
    } else if (lossRatio >= lossRatioMax) {
      tauxCommission = commissionMin;
    } else {
      // Linear interpolation
      const range = lossRatioMax - lossRatioMin;
      const position = (lossRatio - lossRatioMin) / range;
      tauxCommission = commissionMax - (position * (commissionMax - commissionMin));
    }

    const commission = (primes * tauxCommission) / 100;

    return {
      lossRatio: Number(lossRatio.toFixed(2)),
      commission: Number(commission.toFixed(2)),
      tauxCommission: Number(tauxCommission.toFixed(2)),
    };
  }

  /**
   * Validate treaty structure
   */
  validateTreatyStructure(
    treatyType: TreatyType,
    data: {
      primePrevisionnelle?: number;
      pleinConservation?: number;
      nombrePleins?: number;
      franchise?: number;
      portee?: number;
      tauxCession?: number;
    },
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.primePrevisionnelle || data.primePrevisionnelle <= 0) {
      errors.push('Prime prévisionnelle is required and must be positive');
    }

    switch (treatyType) {
      case TreatyType.QP:
        if (!data.tauxCession || data.tauxCession <= 0 || data.tauxCession > 100) {
          errors.push('QP requires valid taux de cession (0-100%)');
        }
        break;

      case TreatyType.SURPLUS:
        if (!data.pleinConservation || data.pleinConservation <= 0) {
          errors.push('Surplus requires plein de conservation');
        }
        if (!data.nombrePleins || data.nombrePleins <= 0) {
          errors.push('Surplus requires nombre de pleins');
        }
        break;

      case TreatyType.XOL:
        if (!data.franchise || data.franchise < 0) {
          errors.push('XOL requires franchise (deductible)');
        }
        if (!data.portee || data.portee <= 0) {
          errors.push('XOL requires portée (coverage)');
        }
        break;

      case TreatyType.STOP_LOSS:
        if (!data.portee || data.portee <= 0) {
          errors.push('Stop Loss requires portée');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
