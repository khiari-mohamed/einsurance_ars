import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { BudgetService } from './budget.service';
import { Affaire } from '../affaires/affaires.entity';
import { Sinistre } from '../sinistres/sinistres.entity';
import { Encaissement } from '../finances/encaissement.entity';
import { Decaissement } from '../finances/decaissement.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Affaire, Sinistre, Encaissement, Decaissement, Cedante, Reassureur])],
  controllers: [ReportingController],
  providers: [ReportingService, BudgetService],
  exports: [ReportingService, BudgetService],
})
export class ReportingModule {}
