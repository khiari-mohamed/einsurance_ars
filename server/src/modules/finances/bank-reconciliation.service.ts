import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BankReconciliationService {
  constructor(private prisma: PrismaService) {}

  async getUnreconciled() {
    const [encaissements, decaissements] = await Promise.all([
      this.prisma.encaissement.findMany({
        where: { bankMovementId: null },
        include: { affaire: { select: { numero: true } } },
        orderBy: { dateEncaissement: 'desc' },
      }),
      this.prisma.decaissement.findMany({
        where: { bankMovementId: null },
        orderBy: { dateDecaissement: 'desc' },
      }),
    ]);
    return { unreconciled: { encaissements, decaissements } };
  }

  async reconcile(encaissementId: string, bankMovementId: string) {
    await this.prisma.$transaction([
      this.prisma.encaissement.update({
        where: { id: encaissementId },
        data: { bankMovementId },
      }),
      this.prisma.bankMovement.update({
        where: { id: bankMovementId },
        data: { isReconciled: true, reconciledAt: new Date() },
      }),
    ]);
    return { message: 'Rapprochement effectué' };
  }

  async importBankMovements(movements: {
    type: string;
    montant: number;
    currency: string;
    dateValeur: string;
    reference?: string;
    description?: string;
  }[]) {
    const created = await this.prisma.$transaction(
      movements.map((m) =>
        this.prisma.bankMovement.create({
          data: {
            type: m.type as any,
            montant: m.montant,
            currency: m.currency,
            dateValeur: new Date(m.dateValeur),
            reference: m.reference,
            description: m.description,
          },
        }),
      ),
    );
    return { imported: created.length };
  }
}