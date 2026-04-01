import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sinistre, SinistreParticipation, ParticipationNotification, SinistreDocument, Expertise, SAPTracking, SAPAdjustment } from './sinistres.entity';
import { SinistreAuditLog } from './sinistre-audit.entity';
import { Affaire } from '../affaires/affaires.entity';
import { SinistresService } from './sinistres.service';
import { SinistresController } from './sinistres.controller';
import { SinistreNotificationService } from './sinistre-notification.service';
import { SinistreDocumentService } from './sinistre-document.service';
import { SinistreCronService } from './sinistre-cron.service';
import { SinistreAuditService } from './sinistre-audit.service';
import { SinistreValidationService } from './sinistre-validation.service';
import { SinistreAnalyticsService } from './sinistre-analytics.service';
import { SinistreBordereauService } from './sinistre-bordereau.service';
import { SinistrePDFService } from './sinistre-pdf.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sinistre,
      SinistreParticipation,
      ParticipationNotification,
      SinistreDocument,
      Expertise,
      SAPTracking,
      SAPAdjustment,
      SinistreAuditLog,
      Affaire,
    ]),
    SharedModule,
  ],
  providers: [
    SinistresService,
    SinistreNotificationService,
    SinistreDocumentService,
    SinistreCronService,
    SinistreAuditService,
    SinistreValidationService,
    SinistreAnalyticsService,
    SinistreBordereauService,
    SinistrePDFService,
  ],
  controllers: [SinistresController],
  exports: [SinistresService],
})
export class SinistresModule {}
