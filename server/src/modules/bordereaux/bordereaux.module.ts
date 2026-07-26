import { Module } from '@nestjs/common';
import { BordereauxController } from './bordereaux.controller';
import { BordereauxService } from './bordereaux.service';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { ReportingModule } from '../reporting/reporting.module';

// CHANGED: ReportingModule (which exports PdfGeneratorService) is now
// imported instead of providing PdfGeneratorService directly — confirmed
// via reporting.module.ts that it's already exported there. Providing it
// again here would have created a second instance with its own separate
// Handlebars compiled-template cache and duplicate helper registration.
//
// SharedModule is NOT imported here — confirmed via shared.module.ts that
// it's decorated @Global(), so SequenceService/AmountToWordsService/
// EmailService/StorageService are already available for injection
// application-wide once SharedModule loads anywhere (typically AppModule).
// Re-importing a @Global() module is harmless but redundant; omitted for
// clarity of actual dependencies.
@Module({
  imports: [ComptabiliteModule, ReportingModule],
  controllers: [BordereauxController],
  providers: [BordereauxService],
  exports: [BordereauxService],
})
export class BordereauxModule {}