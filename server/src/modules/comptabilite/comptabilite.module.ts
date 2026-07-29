import { Module } from '@nestjs/common';
import { ComptabiliteController } from './comptabilite.controller';
import { ComptabiliteService } from './comptabilite.service';
import { AccountingEngineService } from './accounting-engine.service';
import { PlanComptableService } from './plan-comptable.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { IntegrationExportService } from './integration-export.service';
import { TraitesModule } from '../affaires/traites/traites.module';

@Module({
  imports: [TraitesModule],
  controllers: [ComptabiliteController],
  providers: [
    ComptabiliteService, AccountingEngineService, PlanComptableService,
    AuxiliaryAccountService, FiscalPeriodService, IntegrationExportService,
  ],
  exports: [ComptabiliteService, AccountingEngineService, PlanComptableService, FiscalPeriodService, IntegrationExportService],
})
export class ComptabiliteModule {}