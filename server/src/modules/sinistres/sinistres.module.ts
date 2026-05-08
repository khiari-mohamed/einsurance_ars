import { Module } from '@nestjs/common';
import { SinistresController } from './sinistres.controller';
import { SinistresService } from './sinistres.service';
import { SinistreValidationService } from './sinistre-validation.service';
import { SinistreNotificationService } from './sinistre-notification.service';
import { CashCallService } from './cash-call.service';
import { SinistreAnalyticsService } from './sinistre-analytics.service';
import { SinistreCronService } from './sinistre-cron.service';

@Module({
  controllers: [SinistresController],
  providers: [
    SinistresService,
    SinistreValidationService,
    SinistreNotificationService,
    CashCallService,
    SinistreAnalyticsService,
    SinistreCronService,
  ],
  exports: [SinistresService],
})
export class SinistresModule {}