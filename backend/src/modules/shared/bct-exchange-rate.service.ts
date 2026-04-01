import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ExchangeRate } from '../finances/exchange-rate.entity';
import axios from 'axios';

@Injectable()
export class BCTExchangeRateService {
  private readonly logger = new Logger(BCTExchangeRateService.name);
  private readonly BCT_API_URL = 'https://www.bct.gov.tn/bct/siteprod/api/cours_change.jsp';

  constructor(
    @InjectRepository(ExchangeRate)
    private exchangeRateRepo: Repository<ExchangeRate>,
  ) {}

  /**
   * Fetch exchange rates from BCT API
   */
  async fetchFromBCT(): Promise<ExchangeRate[]> {
    try {
      this.logger.log('Fetching exchange rates from BCT...');
      
      const response = await axios.get(this.BCT_API_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'ARS-Reinsurance-System/1.0',
        },
      });

      if (!response.data) {
        throw new Error('No data received from BCT');
      }

      const rates = this.parseBCTResponse(response.data);
      const savedRates: ExchangeRate[] = [];

      for (const rate of rates) {
        const existing = await this.exchangeRateRepo.findOne({
          where: {
            devise: rate.devise!,
            dateRate: rate.dateRate!,
          },
        });

        if (!existing) {
          const saved = await this.exchangeRateRepo.save(rate as ExchangeRate);
          savedRates.push(saved);
        }
      }

      this.logger.log(`Successfully fetched ${savedRates.length} new exchange rates from BCT`);
      return savedRates;
    } catch (error: any) {
      this.logger.error(`Failed to fetch from BCT: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Parse BCT API response
   */
  private parseBCTResponse(data: any): Partial<ExchangeRate>[] {
    const rates: Partial<ExchangeRate>[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.code && item.achat && item.vente) {
          const achat = parseFloat(item.achat);
          const vente = parseFloat(item.vente);
          rates.push({
            devise: item.code.toUpperCase(),
            tauxAchat: achat,
            tauxVente: vente,
            tauxBCT: (achat + vente) / 2,
            tauxARS: (achat + vente) / 2,
            dateRate: today,
            source: 'BCT',
            active: true,
          });
        }
      }
    }

    return rates;
  }

  /**
   * Fallback: Manual entry or scraping
   */
  async fetchFromBCTWebScraping(): Promise<ExchangeRate[]> {
    try {
      this.logger.log('Attempting web scraping from BCT website...');
      
      const response = await axios.get('https://www.bct.gov.tn/bct/siteprod/page.jsp?id=50', {
        timeout: 15000,
      });

      const html = response.data;
      const rates = this.parseHTMLRates(html);
      
      const savedRates: ExchangeRate[] = [];
      for (const rate of rates) {
        const saved = await this.exchangeRateRepo.save(rate);
        savedRates.push(saved);
      }

      this.logger.log(`Web scraping successful: ${savedRates.length} rates`);
      return savedRates;
    } catch (error) {
      this.logger.error(`Web scraping failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse HTML table from BCT website
   */
  private parseHTMLRates(html: string): Partial<ExchangeRate>[] {
    const rates: Partial<ExchangeRate>[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'SAR', 'AED', 'KWD', 'QAR'];
    
    for (const currency of currencies) {
      const pattern = new RegExp(`${currency}[\\s\\S]*?(\\d+\\.\\d+)[\\s\\S]*?(\\d+\\.\\d+)`, 'i');
      const match = html.match(pattern);
      
      if (match) {
        const achat = parseFloat(match[1]);
        const vente = parseFloat(match[2]);
        
        rates.push({
          devise: currency,
          tauxAchat: achat,
          tauxVente: vente,
          tauxBCT: (achat + vente) / 2,
          tauxARS: (achat + vente) / 2,
          dateRate: today,
          source: 'BCT_SCRAPING',
          active: true,
        });
      }
    }

    return rates;
  }

  /**
   * Get latest rate for a currency
   */
  async getLatestRate(devise: string): Promise<ExchangeRate> {
    const rate = await this.exchangeRateRepo.findOne({
      where: { devise: devise.toUpperCase(), active: true },
      order: { dateRate: 'DESC' },
    });

    if (!rate) {
      return this.exchangeRateRepo.create({
        devise: devise.toUpperCase(),
        tauxAchat: 1,
        tauxVente: 1,
        tauxBCT: 1,
        tauxARS: 1,
        dateRate: new Date(),
        source: 'DEFAULT',
        active: true,
      } as Partial<ExchangeRate>) as ExchangeRate;
    }

    return rate;
  }

  /**
   * Convert amount between currencies
   */
  async convertAmount(
    montant: number,
    deviseSource: string,
    deviseCible: string,
    useAchat: boolean = true,
  ): Promise<{ montantConverti: number; tauxUtilise: number; gainPerte?: number }> {
    if (deviseSource === deviseCible) {
      return { montantConverti: montant, tauxUtilise: 1 };
    }

    // Convert to TND first if needed
    let montantTND = montant;
    let tauxSource = 1;

    if (deviseSource !== 'TND') {
      const rateSource = await this.getLatestRate(deviseSource);
      tauxSource = useAchat ? rateSource.tauxAchat : rateSource.tauxVente;
      montantTND = montant * tauxSource;
    }

    // Convert from TND to target currency
    let montantConverti = montantTND;
    let tauxCible = 1;

    if (deviseCible !== 'TND') {
      const rateCible = await this.getLatestRate(deviseCible);
      tauxCible = useAchat ? rateCible.tauxVente : rateCible.tauxAchat; // Inverse for selling
      montantConverti = montantTND / tauxCible;
    }

    const tauxUtilise = tauxSource / tauxCible;

    return {
      montantConverti: Number(montantConverti.toFixed(2)),
      tauxUtilise: Number(tauxUtilise.toFixed(6)),
    };
  }

  /**
   * Calculate gain/perte de change
   */
  async calculateExchangeGainLoss(
    montantOriginal: number,
    deviseOriginal: string,
    tauxOriginal: number,
    tauxActuel?: number,
  ): Promise<{ gainPerte: number; pourcentage: number; type: 'GAIN' | 'PERTE' | 'NEUTRE' }> {
    if (!tauxActuel) {
      const rate = await this.getLatestRate(deviseOriginal);
      // Use BCT reference rate as the current rate baseline
      tauxActuel = Number(rate.tauxBCT);
    }

    const montantTNDOriginal = montantOriginal * tauxOriginal;
    const montantTNDActuel = montantOriginal * tauxActuel;
    const gainPerte = montantTNDActuel - montantTNDOriginal;
    const pourcentage = montantTNDOriginal > 0 ? (gainPerte / montantTNDOriginal) * 100 : 0;

    let type: 'GAIN' | 'PERTE' | 'NEUTRE';
    if (Math.abs(gainPerte) < 0.01) type = 'NEUTRE';
    else if (gainPerte > 0) type = 'GAIN';
    else type = 'PERTE';

    return {
      gainPerte: Number(gainPerte.toFixed(2)),
      pourcentage: Number(pourcentage.toFixed(2)),
      type,
    };
  }

  /**
   * Cron job: Update rates daily at 10 AM
   */
  @Cron('0 10 * * *', { name: 'bct-exchange-rates' })
  async handleDailyUpdate() {
    this.logger.log('Starting daily BCT exchange rate update...');
    
    try {
      // Try API first
      await this.fetchFromBCT();
    } catch (error) {
      this.logger.warn('API fetch failed, trying web scraping...');
      
      try {
        await this.fetchFromBCTWebScraping();
      } catch (scrapingError) {
        this.logger.error('Both API and scraping failed. Manual intervention required.');
      }
    }
  }

  /**
   * Manual rate entry (fallback)
   */
  async createManualRate(data: {
    devise: string;
    tauxAchat: number;
    tauxVente: number;
    date?: Date;
  }): Promise<ExchangeRate> {
    const rate = this.exchangeRateRepo.create({
      devise: data.devise.toUpperCase(),
      tauxAchat: data.tauxAchat,
      tauxVente: data.tauxVente,
      tauxBCT: (data.tauxAchat + data.tauxVente) / 2,
      tauxARS: (data.tauxAchat + data.tauxVente) / 2,
      dateRate: data.date || new Date(),
      source: 'MANUAL',
      active: true,
    } as Partial<ExchangeRate>) as ExchangeRate;

    return this.exchangeRateRepo.save(rate);
  }

  /**
   * Get historical rates for a period
   */
  async getHistoricalRates(
    devise: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ExchangeRate[]> {
    return this.exchangeRateRepo
      .createQueryBuilder('rate')
      .where('rate.devise = :devise', { devise: devise.toUpperCase() })
      .andWhere('rate.dateRate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('rate.dateRate', 'ASC')
      .getMany();
  }
}
