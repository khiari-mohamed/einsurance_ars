import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * NEW (Finances pass): the Currency/ExchangeRate infrastructure built in
 * Référentiel (CDC §6.2 — monthly manual BCT rate entry) was never queried
 * anywhere in Finances. createEncaissement/createDecaissement previously
 * defaulted an unsupplied taux to `1` for ANY currency, silently producing
 * wrong TND-equivalent accounting for foreign-currency transactions where
 * the caller forgot to pass a rate.
 *
 * Kept as a small standalone provider registered directly on FinancesModule
 * rather than promoted into shared/services, since shared.module.ts wasn't
 * part of this review — safer not to guess at its contents. Worth promoting
 * once that file is reviewed, since Comptabilité's GEC will need the same
 * lookup for the same reason.
 */
@Injectable()
export class ExchangeRateResolverService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolves the applicable rate for a currency as of a given date.
   * - TND always resolves to 1 without a lookup.
   * - An explicitly supplied rate always wins (manual override).
   * - Otherwise looks up the most recent ExchangeRate with dateEffet <= date.
   * Throws rather than silently defaulting to 1 — a missing rate must be a
   * visible error, not a silent accounting mistake.
   */
  async resolve(currency: string, explicitTaux?: number, asOfDate?: Date): Promise<number> {
    if (currency === 'TND') return 1;
    if (explicitTaux !== undefined && explicitTaux !== null) return explicitTaux;

    const asOf = asOfDate ?? new Date();
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { currencyCode: currency, dateEffet: { lte: asOf } },
      orderBy: { dateEffet: 'desc' },
    });

    if (!rate) {
      throw new BadRequestException(
        `Aucun taux de change trouvé pour ${currency} à la date du ${asOf.toLocaleDateString('fr-FR')} — saisissez le taux manuellement ou complétez le référentiel des cours de change (BCT).`,
      );
    }

    return Number(rate.taux);
  }
}