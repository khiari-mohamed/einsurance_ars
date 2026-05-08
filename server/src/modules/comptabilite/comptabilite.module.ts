import { Module } from '@nestjs/common';
import { ComptabiliteController } from './comptabilite.controller';
import { ComptabiliteService } from './comptabilite.service';
import { PlanComptableService } from './plan-comptable.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { IntegrationExportService } from './integration-export.service';
import { AccountingEngineService } from './accounting-engine.service';

@Module({
  controllers: [ComptabiliteController],
  providers: [
    ComptabiliteService, PlanComptableService, AuxiliaryAccountService,
    FiscalPeriodService, IntegrationExportService, AccountingEngineService,
  ],
  exports: [AccountingEngineService, PlanComptableService, AuxiliaryAccountService, FiscalPeriodService],
})
export class ComptabiliteModule {}