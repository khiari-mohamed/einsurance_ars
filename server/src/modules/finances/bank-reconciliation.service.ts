import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportBankMovementDto } from './dto/import-bank-movement.dto';

@Injectable()
export class BankReconciliationService {
  constructor(private prisma: PrismaService) {}

  /**
   * NEW (Reconciliation gap fix): there was previously no way to list
   * BankMovement rows at all — only getUnreconciled() (which returns
   * Encaissement/Decaissement rows, not BankMovement) existed. A real
   * reconciliation UI needs to browse the bank side (raw statement lines)
   * to pick one to match against, which this provides.
   */
  async listMovements(filters: {
    reconciled?: boolean;
    type?: FinancialMovementType;
    page?: number;
    limit?: number;
  }) {
    const { reconciled, type, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (reconciled !== undefined) where.isReconciled = reconciled;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.bankMovement.findMany({
        where,
        include: {
          encaissements: { select: { id: true, reference: true, montant: true } },
          decaissements: { select: { id: true, reference: true, montant: true } },
        },
        skip, take: limit,
        orderBy: { dateValeur: 'desc' },
      }),
      this.prisma.bankMovement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

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
      this.prisma.encaissement.update({ where: { id: encaissementId }, data: { bankMovementId } }),
      this.prisma.bankMovement.update({ where: { id: bankMovementId }, data: { isReconciled: true, reconciledAt: new Date() } }),
    ]);
    return { message: 'Rapprochement effectué' };
  }

  async reconcileDecaissement(decaissementId: string, bankMovementId: string) {
    await this.prisma.$transaction([
      this.prisma.decaissement.update({ where: { id: decaissementId }, data: { bankMovementId } }),
      this.prisma.bankMovement.update({ where: { id: bankMovementId }, data: { isReconciled: true, reconciledAt: new Date() } }),
    ]);
    return { message: 'Rapprochement effectué' };
  }

  async unreconcile(bankMovementId: string) {
    const movement = await this.prisma.bankMovement.findUnique({
      where: { id: bankMovementId },
      include: { encaissements: true, decaissements: true },
    });
    if (!movement) throw new NotFoundException('Mouvement bancaire introuvable');

    await this.prisma.$transaction([
      ...movement.encaissements.map((e) => this.prisma.encaissement.update({ where: { id: e.id }, data: { bankMovementId: null } })),
      ...movement.decaissements.map((d) => this.prisma.decaissement.update({ where: { id: d.id }, data: { bankMovementId: null } })),
      this.prisma.bankMovement.update({ where: { id: bankMovementId }, data: { isReconciled: false, reconciledAt: null } }),
    ]);

    return { message: 'Rapprochement annulé' };
  }

  async importBankMovements(movements: ImportBankMovementDto[]) {
    const results: { reference?: string; success: boolean; error?: string }[] = [];

    for (const m of movements) {
      try {
        if (m.reference) {
          const dup = await this.prisma.bankMovement.findFirst({ where: { reference: m.reference } });
          if (dup) throw new Error(`Référence ${m.reference} déjà importée`);
        }
        await this.prisma.bankMovement.create({
          data: {
            type: m.type,
            montant: m.montant,
            currency: m.currency,
            dateValeur: new Date(m.dateValeur),
            reference: m.reference,
            description: m.description,
          },
        });
        results.push({ reference: m.reference, success: true });
      } catch (err: any) {
        results.push({ reference: m.reference, success: false, error: err?.message || 'Erreur inconnue' });
      }
    }

    return {
      total: movements.length,
      imported: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}