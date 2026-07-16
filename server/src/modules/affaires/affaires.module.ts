import { Module, forwardRef } from '@nestjs/common';
import { AffairesController } from './affaires.controller';
import { AffairesService } from './affaires.service';
import { CommissionCalculatorService } from './commission-calculator.service';
import { AffaireWorkflowService } from './workflow.service';
import { FacultativeModule } from './facultative/facultative.module';
import { TraitesModule } from './traites/traites.module';

@Module({
  imports: [forwardRef(() => FacultativeModule), TraitesModule],
  controllers: [AffairesController],
  providers: [AffairesService, CommissionCalculatorService, AffaireWorkflowService],
  exports: [AffairesService, CommissionCalculatorService, FacultativeModule, TraitesModule],
})
export class AffairesModule {}