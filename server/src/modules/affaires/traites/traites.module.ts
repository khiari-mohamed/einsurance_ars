import { Module } from '@nestjs/common';
import { TraitesController } from './traites.controller';
import { TraitesService } from './traites.service';
import { TreatyCalculatorService } from './treaty-calculator.service';
import { TreatyParametersModule } from './treaty-parameters/treaty-parameters.module';

@Module({
  imports: [TreatyParametersModule],
  controllers: [TraitesController],
  providers: [TraitesService, TreatyCalculatorService],
  exports: [TraitesService, TreatyCalculatorService, TreatyParametersModule],
})
export class TraitesModule {}