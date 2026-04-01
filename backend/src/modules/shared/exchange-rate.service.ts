import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './currency.entity';

@Injectable()
export class ExchangeRateService {
  constructor(@InjectRepository(Currency) private repo: Repository<Currency>) {}

  async getRate(fromCurrency: string, toCurrency: string, date?: Date): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const effectiveDate = date || new Date();
    const from = await this.repo.findOne({
      where: { code: fromCurrency },
      order: { effectiveDate: 'DESC' },
    });

    if (toCurrency === 'TND') return from?.rateToTND || 1;

    const to = await this.repo.findOne({
      where: { code: toCurrency },
      order: { effectiveDate: 'DESC' },
    });

    return (from?.rateToTND || 1) / (to?.rateToTND || 1);
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const rate = await this.getRate(from, to);
    return amount * rate;
  }
}
