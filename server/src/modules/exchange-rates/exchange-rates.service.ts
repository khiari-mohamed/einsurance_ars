import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRateDto, CreateCurrencyDto } from './dto/create-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(private prisma: PrismaService) {}

  getCurrencies() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  createCurrency(dto: CreateCurrencyDto) {
    return this.prisma.currency.upsert({
      where: { code: dto.code },
      update: { label: dto.label, isActive: dto.isActive ?? true },
      create: { code: dto.code, label: dto.label, isActive: dto.isActive ?? true },
    });
  }

  getRates(currencyCode?: string, dateFrom?: string, dateTo?: string) {
    return this.prisma.exchangeRate.findMany({
      where: {
        ...(currencyCode && { currencyCode }),
        ...((dateFrom || dateTo) && {
          dateEffet: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }),
      },
      include: { currency: true },
      orderBy: { dateEffet: 'desc' },
    });
  }

  async getLatestRate(currencyCode: string) {
    if (currencyCode === 'TND') return { tauxRealisation: 1, tauxReglement: 1 };
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { currencyCode },
      orderBy: { dateEffet: 'desc' },
    });
    if (!rate) throw new NotFoundException(`Aucun cours trouvé pour ${currencyCode}`);
    return {
      tauxRealisation: Number(rate.tauxRealisation),
      tauxReglement: rate.tauxReglement ? Number(rate.tauxReglement) : null,
      dateEffet: rate.dateEffet,
    };
  }

  async getRateOnDate(currencyCode: string, date: Date): Promise<number> {
    if (currencyCode === 'TND') return 1;
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { currencyCode, dateEffet: { lte: date } },
      orderBy: { dateEffet: 'desc' },
    });
    if (!rate) throw new NotFoundException(`Aucun cours trouvé pour ${currencyCode} à la date ${date.toISOString()}`);
    return Number(rate.tauxRealisation);
  }

  async createRate(dto: CreateRateDto) {
    let currency = await this.prisma.currency.findUnique({ where: { code: dto.currencyCode } });
    if (!currency) {
      currency = await this.prisma.currency.create({
        data: { code: dto.currencyCode, label: dto.currencyCode },
      });
    }
    const dateEffet = new Date(dto.dateEffet);
    dateEffet.setUTCHours(0, 0, 0, 0);  // Normalize to UTC midnight
    return this.prisma.exchangeRate.upsert({
      where: {
        currencyCode_dateEffet: {
          currencyCode: dto.currencyCode,
          dateEffet,
        },
      },
      update: {
        tauxRealisation: dto.tauxRealisation,
        ...(dto.tauxReglement !== undefined && { tauxReglement: dto.tauxReglement }),
        isMonthly: dto.isMonthly ?? false,
      },
      create: {
        currencyId: currency.id,
        currencyCode: dto.currencyCode,
        tauxRealisation: dto.tauxRealisation,
        tauxReglement: dto.tauxReglement,
        dateEffet,
        isMonthly: dto.isMonthly ?? false,
      },
      include: { currency: true },
    });
  }

  updateSettlementRate(id: string, tauxReglement: number) {
    return this.prisma.exchangeRate.update({
      where: { id },
      data: { tauxReglement },
    });
  }

  deleteRate(id: string) {
    return this.prisma.exchangeRate.delete({ where: { id } });
  }

  /** Convert foreign-currency amount to TND (3 decimal places = millimes) */
  convertToTND(amount: number, rate: number): number {
    return Math.round(amount * rate * 1000) / 1000;
  }
}