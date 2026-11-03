import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRatesService } from './exchange-rates.service';

@Injectable()
export class BctSyncService {
  private readonly logger = new Logger(BctSyncService.name);
  constructor(private exchangeRates: ExchangeRatesService) {}

  // The business rule is one synchronization at the beginning of each month.
  @Cron('0 5 1 * *')
  async syncMonthlyRates() {
    try {
      await this.fetchBctRates();
    } catch (error) {
      this.logger.error(`BCT monthly synchronization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async fetchBctRates(date?: Date) {
    const target = date ?? new Date();
    const url = process.env.BCT_RATES_URL || 'https://www.bct.gov.tn/bct/siteprod/cours_a.jsp';
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException(`Source BCT indisponible (${response.status})`);
    }
    const body = await response.text();
    const rates = this.extractRates(body);
    if (rates.length === 0) {
      throw new ServiceUnavailableException('Aucun taux exploitable retourné par la source BCT');
    }
    const effectiveDate = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
    const stored = [];
    for (const rate of rates) {
      try {
        const previous = await this.exchangeRates.getLatestRate(rate.currencyCode);
        const change = Math.abs(rate.taux - previous.taux) / previous.taux;
        if (change > 0.5) {
          throw new ServiceUnavailableException(
            `Variation BCT suspecte pour ${rate.currencyCode}: ${previous.taux} -> ${rate.taux}`,
          );
        }
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        // No previous rate exists; the first observation is accepted.
      }
      stored.push(await this.exchangeRates.createRate({
        currencyCode: rate.currencyCode,
        taux: rate.taux,
        dateEffet: effectiveDate.toISOString(),
        isMonthly: true,
      }));
    }
    this.logger.log(`BCT monthly sync stored ${stored.length} rates for ${effectiveDate.toISOString().slice(0, 10)}`);
    return { dateEffet: effectiveDate, count: stored.length, rates: stored };
  }

  private extractRates(body: string): Array<{ currencyCode: string; taux: number }> {
    try {
      const json = JSON.parse(body);
      const source = Array.isArray(json) ? json : json.rates ?? json.data ?? [];
      if (Array.isArray(source)) {
        return source.map((r: any) => ({
          currencyCode: String(r.currencyCode ?? r.code ?? r.currency ?? '').toUpperCase(),
          taux: Number(r.taux ?? r.rate ?? r.value),
        })).filter((r) => /^[A-Z]{3}$/.test(r.currencyCode) && Number.isFinite(r.taux) && r.taux > 0);
      }
    } catch {
      // BCT currently exposes an HTML page; parse the known table shape below.
    }
    const rates: Array<{ currencyCode: string; taux: number }> = [];
    const html = body.replace(/\s+/g, ' ');
    for (const code of ['EUR', 'USD', 'GBP', 'CHF', 'JPY']) {
      const match = html.match(new RegExp(`${code}.{0,500}?([0-9]+[.,][0-9]{3,6})`, 'i'));
      if (match) {
        const taux = Number(match[1].replace(',', '.'));
        if (Number.isFinite(taux) && taux > 0 && taux < 100000) {
          this.logger.debug(`BCT matched ${code}: ${match[0].slice(0, 180)}`);
          rates.push({ currencyCode: code, taux });
        }
      }
    }
    return rates;
  }
}