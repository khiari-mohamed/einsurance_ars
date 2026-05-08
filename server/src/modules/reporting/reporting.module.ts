import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { DashboardService } from './dashboard.service';
import { BudgetService } from './budget.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, DashboardService, BudgetService, PdfGeneratorService],
  exports: [DashboardService, PdfGeneratorService],
})
export class ReportingModule {}