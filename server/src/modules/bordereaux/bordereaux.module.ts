import { Module } from '@nestjs/common';
import { BordereauxController } from './bordereaux.controller';
import { BordereauxService } from './bordereaux.service';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [ComptabiliteModule, SharedModule],
  controllers: [BordereauxController],
  providers: [BordereauxService],
  exports: [BordereauxService],
})
export class BordereauxModule {}