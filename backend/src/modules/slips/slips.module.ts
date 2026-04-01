import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slip } from './slip.entity';
import { SlipsService } from './slips.service';
import { SlipsController } from './slips.controller';
import { Affaire } from '../affaires/affaires.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Slip, Affaire, Reassureur]),
    SharedModule,
  ],
  providers: [SlipsService],
  controllers: [SlipsController],
  exports: [SlipsService],
})
export class SlipsModule {}
