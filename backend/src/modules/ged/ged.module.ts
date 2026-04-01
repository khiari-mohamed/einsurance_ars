import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GedController } from './ged.controller';
import { GedComplianceController } from './ged-compliance.controller';
import { GedAffaireController } from './ged-affaire.controller';
import { GedSinistreController } from './ged-sinistre.controller';
import { GedFinanceController } from './ged-finance.controller';
import { GedService } from './ged.service';
import { Document } from './document.entity';
import { DocumentLink } from './document-link.entity';
import { DocumentVersion } from './document-version.entity';
import { DocumentAccessLog } from './document-access-log.entity';
import { DocumentShare } from './document-share.entity';
import { ComplianceService } from './compliance.service';
import { AffaireIntegrationService } from './affaire-integration.service';
import { SinistreIntegrationService } from './sinistre-integration.service';
import { FinanceIntegrationService } from './finance-integration.service';
import { OcrService } from './ocr.service';
import { RetentionService } from './retention.service';
import { GedTasks } from './ged.tasks';
import { FileValidationService } from './file-validation.service';
import { SharedModule } from '../shared/shared.module';
import { Affaire } from '../affaires/affaires.entity';
import { Sinistre } from '../sinistres/sinistres.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentLink,
      DocumentVersion,
      DocumentAccessLog,
      DocumentShare,
      Affaire,
      Sinistre,
      Bordereau,
    ]),
    SharedModule,
  ],
  controllers: [
    GedController,
    GedComplianceController,
    GedAffaireController,
    GedSinistreController,
    GedFinanceController,
  ],
  providers: [
    GedService,
    ComplianceService,
    AffaireIntegrationService,
    SinistreIntegrationService,
    FinanceIntegrationService,
    OcrService,
    RetentionService,
    GedTasks,
    FileValidationService,
  ],
  exports: [
    GedService,
    ComplianceService,
    AffaireIntegrationService,
    SinistreIntegrationService,
    FinanceIntegrationService,
    OcrService,
    RetentionService,
  ],
})
export class GedModule {}
