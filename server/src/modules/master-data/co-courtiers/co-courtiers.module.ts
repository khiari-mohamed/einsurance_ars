import { Module } from '@nestjs/common';
import { CoCourtierController } from './co-courtiers.controller';
import { CoCourtierService } from './co-courtiers.service';
@Module({ controllers: [CoCourtierController], providers: [CoCourtierService], exports: [CoCourtierService] })
export class CoCourtierModule {}