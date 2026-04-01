import { Injectable } from '@nestjs/common';

@Injectable()
export class CommissionCalculatorService {
  calculateCedanteCommission(primeCedee: number, tauxCommission: number): number {
    return primeCedee * (tauxCommission / 100);
  }

  calculateARSCommission(primeCedee: number, commissionCedante: number, tauxARS: number): number {
    const base = primeCedee - commissionCedante;
    return base * (tauxARS / 100);
  }

  calculateNetPremium(primeCedee: number, commissionCedante: number): number {
    return primeCedee - commissionCedante;
  }
}
