import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, LessThan } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';

@Injectable()
export class ExchangeRateService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly rateRepo: Repository<ExchangeRate>,
  ) {}

  /**
   * Create or update exchange rate for a currency
   */
  async createOrUpdateRate(data: {
    devise: string;
    dateRate: Date;
    tauxBCT: number;
    tauxARS: number;
    tauxVente: number;
    tauxAchat: number;
    source: string;
    dateRecuperation: Date;
    active: boolean;
  }): Promise<ExchangeRate> {
    // Check if rate exists for this currency on this date
    const existing = await this.rateRepo.findOne({
      where: {
        devise: data.devise,
        dateRate: data.dateRate,
      },
    });

    if (existing) {
      // Update existing rate
      return this.rateRepo.save({
        ...existing,
        tauxBCT: data.tauxBCT,
        tauxARS: data.tauxARS,
        tauxVente: data.tauxVente,
        tauxAchat: data.tauxAchat,
        dateRecuperation: data.dateRecuperation,
      });
    }

    // Create new rate
    const rate = this.rateRepo.create(data);
    return this.rateRepo.save(rate);
  }

  /**
   * Get current exchange rate for a currency
   */
  async getCurrentRate(devise: string): Promise<ExchangeRate> {
    const rate = await this.rateRepo.findOne({
      where: {
        devise,
        active: true,
      },
      order: {
        dateRate: 'DESC',
      },
    });

    if (!rate) {
      throw new NotFoundException(`No active rate found for ${devise}`);
    }

    return rate;
  }

  /**
   * Get historical rates for a currency in a period
   */
  async getHistoricalRates(
    devise: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ExchangeRate[]> {
    return this.rateRepo.find({
      where: {
        devise,
        dateRate: Between(startDate, endDate),
      },
      order: {
        dateRate: 'ASC',
      },
    });
  }

  /**
   * Convert amount from foreign currency to TND using applicable rate
   */
  async convertToTND(devise: string, montant: number, dateTransaction: Date): Promise<number> {
    const rate = await this.rateRepo.findOne({
      where: {
        devise,
        active: true,
        dateRate: LessThanOrEqual(dateTransaction),
      },
      order: {
        dateRate: 'DESC',
      },
    });

    if (!rate) {
      throw new NotFoundException(
        `No exchange rate found for ${devise} on or before ${dateTransaction.toISOString()}`,
      );
    }

    return montant * rate.tauxARS;
  }

  /**
   * Get all active rates
   */
  async getAllActiveRates(): Promise<ExchangeRate[]> {
    return this.rateRepo.find({
      where: { active: true },
      order: { dateRate: 'DESC' },
    });
  }

  /**
   * Deactivate old rates for a currency
   */
  async deactivateOldRates(devise: string, keepDays: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);

    await this.rateRepo
      .createQueryBuilder()
      .update(ExchangeRate)
      .set({ active: false })
      .where('devise = :devise', { devise })
      .andWhere('dateRate < :cutoffDate', { cutoffDate })
      .execute();
  }
}
