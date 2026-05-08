import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRatesService } from './exchange-rates.service';

@Injectable()
export class BctSyncService {
  private readonly logger = new Logger(BctSyncService.name);
  constructor(private exchangeRates: ExchangeRatesService) {}

  // Weekdays at 09:00 — BCT publishes daily rates
  @Cron('0 9 * * 1-5')
  async syncDailyRates() {
    this.logger.log('BCT daily rate sync check...');
    // TODO: implement BCT scraping when BCT exposes a stable API
    // BCT reference: https://www.bct.gov.tn/bct/siteprod/cours_a.jsp
    this.logger.warn('BCT sync: awaiting API — manual entry required until BCT API is available');
  }

  async fetchBctRates(date?: Date) {
    const target = date ?? new Date();
    this.logger.log(`Manual BCT fetch triggered for ${target.toISOString().split('T')[0]}`);
    // Placeholder — integrate when BCT provides XML/JSON feed
    return { message: 'BCT sync initié — intégration API BCT requise pour automatisation complète' };
  }
}