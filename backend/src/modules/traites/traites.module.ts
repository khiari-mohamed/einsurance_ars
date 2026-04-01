import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Traite } from './traites.entity';
import { TraitesService } from './traites.service';
import { TraitesController } from './traites.controller';
import { TreatyCalculatorService } from './treaty-calculator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Traite])],
  providers: [TraitesService, TreatyCalculatorService],
  controllers: [TraitesController],
  exports: [TraitesService, TreatyCalculatorService],
})
export class TraitesModule {}
