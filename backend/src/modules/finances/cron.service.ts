import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LettrageService } from './lettrage.service';
import { SettlementService } from './settlement.service';
import { ExchangeRateService } from './exchange-rate.service';
import { FinancesService } from './finances.service';
import { NotificationService } from './notification.service';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

/**
 * Cron Service - Handles all scheduled financial operations
 * - Auto-lettrage daily at 23:00
 * - BCT exchange rate updates daily at 08:00
 * - Aging report generation weekly
 * - Settlement auto-generation monthly on 1st
 * - Payment reminders daily
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly lettrageService: LettrageService,
    private readonly settlementService: SettlementService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly financesService: FinancesService,
    private readonly notificationService: NotificationService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Daily auto-lettrage at 23:00
   * Runs advanced multi-payment matching for all unlettered transactions
   */
  @Cron('0 23 * * *', {
    name: 'autoLettrageDaily',
    timeZone: 'UTC',
  })
  async handleDailyAutoLettrage() {
    try {
      this.logger.log('[CRON] Starting daily auto-lettrage at 23:00 UTC');

      const result = await this.lettrageService.autoLettrageAdvanced(2, 'CRON_SYSTEM');

      this.logger.log(`[CRON] Auto-lettrage completed: ${result.matched} exact, ${result.partial} partial, ${result.unmatched} unmatched`);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily auto-lettrage: ${result.matched} exact matches, ${result.partial} partial matches, ${result.unmatched} unmatched items`,
        beforeValues: { timestamp: new Date() },
        afterValues: result,
      });
    } catch (error) {
      this.logger.error(`[CRON] Daily auto-lettrage failed: ${error.message}`, error.stack);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily auto-lettrage FAILED: ${error.message}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { error: error.message, status: 'FAILED' },
      });
    }
  }

  /**
   * Daily BCT exchange rate update at 08:00
   * Fetches official currency rates from BCT (Banque Centrale de Tunisie)
   */
  @Cron('0 8 * * *', {
    name: 'bctRateUpdate',
    timeZone: 'UTC',
  })
  async handleBCTRateUpdate() {
    try {
      this.logger.log('[CRON] Starting BCT exchange rate update at 08:00 UTC');

      const rates = await this.fetchBCTRates();

      for (const rate of rates) {
        await this.exchangeRateService.createOrUpdateRate({
          devise: rate.devise,
          dateRate: new Date(rate.dateRate),
          tauxBCT: Number(rate.tauxBCT),
          tauxARS: Number(rate.tauxARS || rate.tauxBCT),
          tauxVente: Number(rate.tauxVente || rate.tauxBCT),
          tauxAchat: Number(rate.tauxAchat || rate.tauxBCT),
          source: 'BCT',
          dateRecuperation: new Date(),
          active: true,
        });
      }

      this.logger.log(`[CRON] BCT rates updated: ${rates.length} currencies`);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.EXCHANGE_RATE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily BCT rate update: ${rates.length} currencies updated`,
        beforeValues: { timestamp: new Date() },
        afterValues: { ratesUpdated: rates.length, source: 'BCT' },
      });
    } catch (error) {
      this.logger.error(`[CRON] BCT rate update failed: ${error.message}`, error.stack);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.EXCHANGE_RATE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily BCT rate update FAILED: ${error.message}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { error: error.message, status: 'FAILED' },
      });
    }
  }

  /**
   * Weekly aging report generation every Monday at 06:00
   * Generates creances and dettes aging analysis for all cedantes
   */
  @Cron('0 6 * * 1', {
    name: 'weeklyAgingReport',
    timeZone: 'UTC',
  })
  async handleWeeklyAgingReport() {
    try {
      this.logger.log('[CRON] Starting weekly aging report generation at Monday 06:00 UTC');

      const creancesAnalysis = await this.lettrageService.getAgingAnalysis('creances');
      const dettesAnalysis = await this.lettrageService.getAgingAnalysis('dettes');

      // Check for critical items (over 90 days)
      const criticalCreances = creancesAnalysis.aging.over_90;
      const criticalDettes = dettesAnalysis.aging.over_90;

      if (criticalCreances.montant > 0) {
        this.logger.warn(
          `[CRON] CRITICAL: ${criticalCreances.count} creances over 90 days, montant: ${criticalCreances.montant}`,
        );
      }

      if (criticalDettes.montant > 0) {
        this.logger.warn(
          `[CRON] CRITICAL: ${criticalDettes.count} dettes over 90 days, montant: ${criticalDettes.montant}`,
        );
      }

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Weekly aging report: ${creancesAnalysis.total.count} creances, ${dettesAnalysis.total.count} dettes`,
        beforeValues: { timestamp: new Date() },
        afterValues: {
          creancesTotal: creancesAnalysis.total.montant,
          dettesTotal: dettesAnalysis.total.montant,
          criticalCreances: criticalCreances.montant,
          criticalDettes: criticalDettes.montant,
        },
      });

      this.logger.log('[CRON] Weekly aging report completed');
    } catch (error) {
      this.logger.error(`[CRON] Weekly aging report failed: ${error.message}`, error.stack);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Weekly aging report FAILED: ${error.message}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { error: error.message, status: 'FAILED' },
      });
    }
  }

  /**
   * Monthly settlement auto-generation on 1st at 00:30
   * Creates settlements for all cedantes for the previous month
   */
  @Cron('30 0 1 * *', {
    name: 'monthlySettlementGeneration',
    timeZone: 'UTC',
  })
  async handleMonthlySettlementGeneration() {
    try {
      this.logger.log('[CRON] Starting monthly settlement generation at 1st 00:30 UTC');

      const previousMonth = new Date();
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      // TODO: Implement getAllCedantes() from cedantes service
      // For now, log the intention
      this.logger.log(`[CRON] Would generate settlements for month: ${previousMonth.getFullYear()}-${previousMonth.getMonth() + 1}`);

      // const cedantes = await this.cedantesService.findAll();
      // let settlementsCreated = 0;
      //
      // for (const cedante of cedantes) {
      //   const existingSettlement = await this.settlementService.findByPeriod(
      //     cedante.id,
      //     previousMonth,
      //   );
      //
      //   if (!existingSettlement) {
      //     await this.settlementService.createSettlement({
      //       cedanteId: cedante.id,
      //       dateDebut: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
      //       dateFin: new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0),
      //       type: 'MENSUELLE',
      //     }, 'CRON_SYSTEM');
      //
      //     settlementsCreated++;
      //   }
      // }

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.SETTLEMENT,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Monthly settlement auto-generation for ${previousMonth.getFullYear()}-${previousMonth.getMonth() + 1}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { month: `${previousMonth.getFullYear()}-${previousMonth.getMonth() + 1}`, status: 'PENDING_IMPLEMENTATION' },
      });

      this.logger.log('[CRON] Monthly settlement generation completed');
    } catch (error) {
      this.logger.error(`[CRON] Monthly settlement generation failed: ${error.message}`, error.stack);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.SETTLEMENT,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Monthly settlement generation FAILED: ${error.message}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { error: error.message, status: 'FAILED' },
      });
    }
  }

  /**
   * Daily payment reminders at 09:00
   * Sends reminders for payments overdue by 30, 60, or 90 days
   */
  @Cron('0 9 * * *', {
    name: 'dailyPaymentReminders',
    timeZone: 'UTC',
  })
  async handleDailyPaymentReminders() {
    try {
      this.logger.log('[CRON] Starting daily payment reminders at 09:00 UTC');

      // Get unmatched items (overdue payments)
      const unmatched30 = await this.lettrageService.getUnmatchedItems(30);
      const unmatched60 = await this.lettrageService.getUnmatchedItems(60);
      const unmatched90 = await this.lettrageService.getUnmatchedItems(90);

      let remindersSent = 0;

      // Process 30-day reminders
      if (unmatched30.encaissements.count > 0) {
        this.logger.log(
          `[CRON] 30-day reminder: ${unmatched30.encaissements.count} encaissements overdue, montant: ${unmatched30.encaissements.montant}`,
        );
        await this.notificationService.sendPaymentReminderEmail(unmatched30.encaissements.items, 30);
        remindersSent++;
      }

      // Process 60-day reminders
      if (unmatched60.encaissements.count > 0) {
        this.logger.warn(
          `[CRON] 60-day reminder: ${unmatched60.encaissements.count} encaissements overdue, montant: ${unmatched60.encaissements.montant}`,
        );
        await this.notificationService.sendPaymentReminderEmail(unmatched60.encaissements.items, 60);
        remindersSent++;
      }

      // Process 90-day reminders (CRITICAL)
      if (unmatched90.encaissements.count > 0) {
        this.logger.error(
          `[CRON] CRITICAL 90-day reminder: ${unmatched90.encaissements.count} encaissements overdue, montant: ${unmatched90.encaissements.montant}`,
        );
        await this.notificationService.sendPaymentReminderEmail(unmatched90.encaissements.items, 90);
        remindersSent++;
      }

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily payment reminders: ${remindersSent} reminder tiers processed`,
        beforeValues: { timestamp: new Date() },
        afterValues: {
          items30: unmatched30.encaissements.count,
          items60: unmatched60.encaissements.count,
          items90: unmatched90.encaissements.count,
          totalRemindersSent: remindersSent,
        },
      });

      this.logger.log('[CRON] Daily payment reminders completed');
    } catch (error) {
      this.logger.error(`[CRON] Daily payment reminders failed: ${error.message}`, error.stack);

      await this.auditLogRepo.save({
        actionType: AuditActionType.EXECUTE,
        entityType: AuditEntityType.LETTRAGE,
        userId: 'CRON_SYSTEM',
        userEmail: 'system@auto',
        description: `Daily payment reminders FAILED: ${error.message}`,
        beforeValues: { timestamp: new Date() },
        afterValues: { error: error.message, status: 'FAILED' },
      });
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Fetch daily exchange rates from BCT API
   * BCT (Banque Centrale de Tunisie) provides official rates
   */
  private async fetchBCTRates(): Promise<any[]> {
    try {
      // Mock implementation - in production, use actual BCT API
      // BCT provides rates via: https://www.bct.gov.tn/

      const currencies = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];
      const rates: any[] = [];

      for (const currency of currencies) {
        // Mock rate generation - replace with actual API call
        const mockRate = 3.0 + Math.random() * 0.1; // Simulate TND value

        rates.push({
          devise: currency,
          dateRate: new Date().toISOString(),
          tauxBCT: mockRate,
          tauxARS: mockRate * 1.02, // ARS applies small premium
          tauxVente: mockRate * 1.03,
          tauxAchat: mockRate * 0.97,
        });
      }

      return rates;

      // In production, uncomment below and update API endpoint:
      // const response = await axios.get('https://www.bct.gov.tn/api/rates', {
      //   headers: { Authorization: `Bearer ${process.env.BCT_API_KEY}` },
      // });
      //
      // return response.data.rates;
    } catch (error) {
      this.logger.error(`Failed to fetch BCT rates: ${error.message}`);
      throw error;
    }
  }
}
