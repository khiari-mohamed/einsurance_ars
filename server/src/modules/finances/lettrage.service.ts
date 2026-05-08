import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';

export interface LettrageMatchItem {
  bordereauId: string;
  montant: number;
}

@Injectable()
export class LettrageService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  /**
   * Get open items (unpaid bordereaux) for a cedante — used to populate
   * the lettrage selection UI before matching
   */
  async getOpenItems(cedanteId: string) {
    return this.prisma.bordereau.findMany({
      where: {
        cedanteId,
        statut: { in: ['EMIS'] },
        lettrageItems: { none: { isLettre: true } },
      },
      include: { affaire: { select: { numero: true } } },
      orderBy: { dateEmission: 'asc' },
    });
  }

  /**
   * Perform full lettrage workflow:
   * 1. Show open bordereaux for cedante
   * 2. Match selected ones against the encaissement
   * 3. Compute residual (over/under-payment)
   * 4. Mark matched bordereaux as ACQUITTE if fully covered
   */
  async lettre(
    encaissementId: string,
    matches: LettrageMatchItem[],
    cedanteId?: string,
    reassureurCode?: string,
  ) {
    const enc = await this.prisma.encaissement.findUnique({ where: { id: encaissementId } });
    if (!enc) throw new NotFoundException('Encaissement introuvable');

    const totalMatched = matches.reduce((s, m) => s + m.montant, 0);
    if (totalMatched <= 0) throw new BadRequestException('Montant lettrée doit être > 0');

    const reference = await this.sequence.next('LETTRAGE');
    const residuel = Math.round((Number(enc.montant) - totalMatched) * 1000) / 1000;

    const lettrage = await this.prisma.$transaction(async (tx) => {
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

      // Mark fully covered bordereaux as ACQUITTE
      for (const match of matches) {
        const bdr = await tx.bordereau.findUnique({ where: { id: match.bordereauId } });
        if (!bdr) continue;
        const totalForBdr = Number(bdr.montantTotal ?? 0);
        const allMatched = await tx.lettrageItem.aggregate({
          where: { bordereauId: match.bordereauId, isLettre: true },
          _sum: { montant: true },
        });
        const coveredAmount = Number(allMatched._sum.montant ?? 0);
        if (coveredAmount >= totalForBdr - 0.001) {
          await tx.bordereau.update({
            where: { id: match.bordereauId },
            data: { statut: 'ACQUITTE' },
          });
        }
      }

      return l;
    });

    return lettrage;
  }

  async findAll(cedanteId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (cedanteId) where.cedanteId = cedanteId;
    const [data, total] = await Promise.all([
      this.prisma.lettrage.findMany({ where, include: { items: { include: { bordereau: true } } }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
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