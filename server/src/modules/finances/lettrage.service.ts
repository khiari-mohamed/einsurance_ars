import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { CreateLettrageDto } from './dto/lettrage.dto';

@Injectable()
export class LettrageService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  /**
   * FIX (Finances pass): the `lettrageItems: { none: { isLettre: true } }`
   * clause actively excluded PARTIALLY paid bordereaux from the open-items
   * list — any prior partial match made this condition false even though a
   * real outstanding balance remained (the bordereau's own statut stays
   * EMIS, not ACQUITTE, until fully covered). Removed; statut alone is the
   * correct completeness signal. Now also surfaces `montantRestant` using
   * the new Bordereau.montantRegle cached field, so the UI doesn't need to
   * re-derive it from lettrageItems sums.
   */
  async getOpenItems(cedanteId: string) {
    const bordereaux = await this.prisma.bordereau.findMany({
      where: { cedanteId, statut: 'EMIS' },
      include: { affaire: { select: { numero: true } } },
      orderBy: { dateEmission: 'asc' },
    });

    return bordereaux.map((b) => ({
      ...b,
      montantRestant: Math.round((Number(b.montantTotal ?? 0) - Number(b.montantRegle ?? 0)) * 1000) / 1000,
    }));
  }

  /**
   * Perform full lettrage workflow:
   * 1. Validate the encaissement and every targeted bordereau up front
   * 2. Match selected bordereaux against the encaissement
   * 3. Record a BordereauPayment + bump montantRegle on each bordereau
   * 4. Mark fully-covered bordereaux ACQUITTE
   *
   * FIX (Finances pass): previously this method only ever touched
   * Lettrage/LettrageItem and the bordereau's statut — the new
   * BordereauPayment model and Bordereau.montantRegle cache (added since
   * the last schema pass) were never written to at all, leaving two
   * disconnected sources of truth for "how much of this bordereau has been
   * paid." Now they move together atomically. Also added: over-lettrage
   * guards (can't match more than was received, can't match more than a
   * bordereau's remaining balance), a guard against targeting an
   * already-closed bordereau, and an audit log entry — this touches real
   * money and every other financial mutation in the app logs one.
   */
  async lettre(dto: CreateLettrageDto, userId?: string) {
    const { encaissementId, matches, cedanteId, reassureurCode } = dto;

    const enc = await this.prisma.encaissement.findUnique({ where: { id: encaissementId } });
    if (!enc) throw new NotFoundException('Encaissement introuvable');

    const totalMatched = matches.reduce((s, m) => s + m.montant, 0);
    if (totalMatched <= 0) throw new BadRequestException('Montant lettré doit être > 0');
    if (totalMatched > Number(enc.montant) + 0.001) {
      throw new BadRequestException('Le montant total lettré ne peut pas dépasser le montant encaissé');
    }

    const bordereaux = await this.prisma.bordereau.findMany({
      where: { id: { in: matches.map((m) => m.bordereauId) } },
    });
    const byId = new Map(bordereaux.map((b) => [b.id, b]));

    for (const m of matches) {
      const b = byId.get(m.bordereauId);
      if (!b) throw new NotFoundException(`Bordereau ${m.bordereauId} introuvable`);
      if (b.statut === 'ACQUITTE' || b.statut === 'ARCHIVE') {
        throw new BadRequestException(
          `Le bordereau ${b.numero} est déjà ${b.statut === 'ACQUITTE' ? 'acquitté' : 'archivé'}`,
        );
      }
      const restant = Number(b.montantTotal ?? 0) - Number(b.montantRegle ?? 0);
      if (m.montant > restant + 0.001) {
        throw new BadRequestException(
          `Le montant lettré (${m.montant}) dépasse le solde restant du bordereau ${b.numero} (${restant})`,
        );
      }
    }

    const reference = await this.sequence.next('LETTRAGE');
    const residuel = Math.round((Number(enc.montant) - totalMatched) * 1000) / 1000;

    return this.prisma.$transaction(async (tx) => {
      const l = await tx.lettrage.create({
        data: {
          reference,
          cedanteId,
          reassureurCode,
          montantEncaisse: enc.montant,
          montantLettre: totalMatched,
          residuel,
          isComplete: Math.abs(residuel) < 0.001,
          items: {
            create: matches.map((m) => ({
              bordereauId: m.bordereauId,
              encaissementId,
              montant: m.montant,
              isLettre: true,
              lettreAt: new Date(),
            })),
          },
        },
        include: { items: { include: { bordereau: true } } },
      });

      for (const match of matches) {
        const bdr = byId.get(match.bordereauId)!;

        await tx.bordereauPayment.create({
          data: {
            bordereauId: match.bordereauId,
            montant: match.montant,
            modePaiement: PaymentMode.VIREMENT,
            datePaiement: enc.dateEncaissement,
            referenceBancaire: enc.reference,
            notes: `Lettrage ${reference}`,
            recordedByUserId: userId,
          },
        });

        const updated = await tx.bordereau.update({
          where: { id: match.bordereauId },
          data: { montantRegle: { increment: match.montant } },
        });

        if (Number(updated.montantRegle) >= Number(updated.montantTotal ?? bdr.montantTotal ?? 0) - 0.001) {
          await tx.bordereau.update({ where: { id: match.bordereauId }, data: { statut: 'ACQUITTE' } });
        }
      }

      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'LETTRAGE_CREATED',
            entityType: 'Lettrage',
            entityId: l.id,
            after: { reference, encaissementId, totalMatched, residuel, bordereauIds: matches.map((m) => m.bordereauId) },
          },
        });
      }

      return l;
    });
  }

  async findAll(cedanteId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (cedanteId) where.cedanteId = cedanteId;
    const [data, total] = await Promise.all([
      this.prisma.lettrage.findMany({
        where,
        include: { items: { include: { bordereau: true } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lettrage.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  findOne(id: string) {
    return this.prisma.lettrage.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { bordereau: true, encaissement: true } } },
    });
  }
}