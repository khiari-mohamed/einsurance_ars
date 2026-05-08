import { Module } from '@nestjs/common';
import { ReassureursController } from './reassureurs.controller';
import { ReassureursService } from './reassureurs.service';
@Module({ controllers: [ReassureursController], providers: [ReassureursService], exports: [ReassureursService] })
export class ReassureursModule {}