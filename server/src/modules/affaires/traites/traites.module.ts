import { Module } from '@nestjs/common';
import { TraitesController } from './traites.controller';
import { TraitesService } from './traites.service';
import { TreatyCalculatorService } from './treaty-calculator.service';
import { TreatyParametersModule } from './treaty-parameters/treaty-parameters.module';
import { CommissionCalculatorService } from '../commission-calculator.service';

@Module({
  imports: [TreatyParametersModule],
  controllers: [TraitesController],
  providers: [TraitesService, TreatyCalculatorService, CommissionCalculatorService],
  exports: [TraitesService, TreatyCalculatorService, TreatyParametersModule],
})
export class TraitesModule {}