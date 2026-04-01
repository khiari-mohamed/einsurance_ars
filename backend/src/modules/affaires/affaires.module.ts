import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Affaire, AffaireReassureur } from './affaires.entity';
import { AffairesService } from './affaires.service';
import { AffairesController } from './affaires.controller';
import { CommissionService } from './commission.service';
import { WorkflowService } from './workflow.service';
import { GedModule } from '../ged/ged.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Affaire, AffaireReassureur]),
    GedModule,
  ],
  providers: [AffairesService, CommissionService, WorkflowService],
  controllers: [AffairesController],
  exports: [AffairesService, CommissionService, WorkflowService],
})
export class AffairesModule {}
