import { Module } from '@nestjs/common';
import { BordereauxController } from './bordereaux.controller';
import { BordereauxService } from './bordereaux.service';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [ComptabiliteModule],
  controllers: [BordereauxController],
  providers: [BordereauxService],
  exports: [BordereauxService],
})
export class BordereauxModule {}