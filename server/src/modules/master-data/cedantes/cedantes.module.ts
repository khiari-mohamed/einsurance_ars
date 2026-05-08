import { Module } from '@nestjs/common';
import { CedantesController } from './cedantes.controller';
import { CedantesService } from './cedantes.service';
@Module({ controllers: [CedantesController], providers: [CedantesService], exports: [CedantesService] })
export class CedantesModule {}