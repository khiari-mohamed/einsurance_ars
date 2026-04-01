import { Injectable, BadRequestException } from '@nestjs/common';
import { CommissionCalculMode } from './affaires.entity';

@Injectable()
export class CommissionService {
  calculateCommissionARS(
    primeCedee: number,
    taux: number,
    mode: CommissionCalculMode,
    manualValue?: number,
  ): number {
    if (mode === CommissionCalculMode.MANUEL && manualValue !== undefined) {
      if (manualValue > primeCedee) {
        throw new BadRequestException('Commission ARS cannot exceed prime cédée');
      }
      if (manualValue < 0) {
        throw new BadRequestException('Commission ARS cannot be negative');
      }
      return Number(manualValue.toFixed(2));
    }

    if (taux < 0 || taux > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }

    const commission = (primeCedee * taux) / 100;
    return Number(commission.toFixed(2));
  }

  calculateCommissionCedante(
    primeCedee: number,
    taux: number,
    commissionARS: number,
    mode: CommissionCalculMode,
    manualValue?: number,
  ): number {
    if (mode === CommissionCalculMode.MANUEL && manualValue !== undefined) {
      if (manualValue > primeCedee) {
        throw new BadRequestException('Commission cédante cannot exceed prime cédée');
      }
      if (manualValue < commissionARS) {
        throw new BadRequestException('Commission cédante cannot be less than commission ARS');
      }
      if (manualValue < 0) {
        throw new BadRequestException('Commission cédante cannot be negative');
      }
      return Number(manualValue.toFixed(2));
    }

    if (taux < 0 || taux > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }

    const commission = (primeCedee * taux) / 100;

    if (commission < commissionARS) {
      throw new BadRequestException(
        `Commission cédante (${commission.toFixed(2)}) cannot be less than commission ARS (${commissionARS.toFixed(2)})`,
      );
    }

    return Number(commission.toFixed(2));
  }

  validateCommissions(primeCedee: number, commissionCedante: number, commissionARS: number): void {
    if (commissionCedante > primeCedee) {
      throw new BadRequestException('Commission cédante exceeds prime cédée');
    }
    if (commissionARS > primeCedee) {
      throw new BadRequestException('Commission ARS exceeds prime cédée');
    }
    if (commissionARS > commissionCedante) {
      throw new BadRequestException('Commission ARS exceeds commission cédante');
    }
  }
}
