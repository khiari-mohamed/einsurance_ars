import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportBankMovementDto } from './dto/import-bank-movement.dto';

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

  /**
   * FIX (Finances pass, new): Decaissement.bankMovementId exists on the
   * schema but there was no reconciliation path for it at all — only
   * encaissements could ever be matched to a bank movement.
   */
  async reconcileDecaissement(decaissementId: string, bankMovementId: string) {
    await this.prisma.$transaction([
      this.prisma.decaissement.update({
        where: { id: decaissementId },
        data: { bankMovementId },
      }),
      this.prisma.bankMovement.update({
        where: { id: bankMovementId },
        data: { isReconciled: true, reconciledAt: new Date() },
      }),
    ]);
    return { message: 'Rapprochement effectué' };
  }

  /**
   * FIX (Finances pass, new): no way to undo a wrong match — a fat-fingered
   * reconciliation was permanent.
   */
  async unreconcile(bankMovementId: string) {
    const movement = await this.prisma.bankMovement.findUnique({
      where: { id: bankMovementId },
      include: { encaissements: true, decaissements: true },
    });
    if (!movement) throw new NotFoundException('Mouvement bancaire introuvable');

    await this.prisma.$transaction([
      ...movement.encaissements.map((e) =>
        this.prisma.encaissement.update({ where: { id: e.id }, data: { bankMovementId: null } }),
      ),
      ...movement.decaissements.map((d) =>
        this.prisma.decaissement.update({ where: { id: d.id }, data: { bankMovementId: null } }),
      ),
      this.prisma.bankMovement.update({
        where: { id: bankMovementId },
        data: { isReconciled: false, reconciledAt: null },
      }),
    ]);

    return { message: 'Rapprochement annulé' };
  }

  /**
   * FIX (Finances pass): `type: string` was blindly cast `as any` with no
   * enum validation, and there was no guard against importing the same bank
   * statement line twice (a re-run of the same import file would silently
   * double the bank movements). Now validated per-row via the DTO and
   * deduplicated on `reference` when provided, with a per-row success
   * report — mirrors the bulk-import pattern used across Référentiel.
   */
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