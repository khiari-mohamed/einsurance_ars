import { Module } from '@nestjs/common';
import { TraitesController } from './traites.controller';
import { TraitesService } from './traites.service';
import { TreatyCalculatorService } from './treaty-calculator.service';

@Module({
  controllers: [TraitesController],
  providers: [TraitesService, TreatyCalculatorService],
  exports: [TraitesService, TreatyCalculatorService],
})
export class TraitesModule {}