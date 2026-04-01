import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProspectionService } from './prospection.service';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Affaire, Cedante])],
  providers: [ProspectionService],
  exports: [ProspectionService],
})
export class ProspectionModule {}
