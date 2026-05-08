import { Module } from '@nestjs/common';
import { AffairesController } from './affaires.controller';
import { AffairesService } from './affaires.service';
import { CommissionCalculatorService } from './commission-calculator.service';
import { AffaireWorkflowService } from './workflow.service';

@Module({
  controllers: [AffairesController],
  providers: [AffairesService, CommissionCalculatorService, AffaireWorkflowService],
  exports: [AffairesService, CommissionCalculatorService],
})
export class AffairesModule {}