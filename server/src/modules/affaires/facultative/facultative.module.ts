import { Module } from '@nestjs/common';
import { FacultativeController } from './facultative.controller';
import { FacultativeService } from './facultative.service';
import { AffairesModule } from '../../affaires/affaires.module';

@Module({
  imports: [AffairesModule],
  controllers: [FacultativeController],
  providers: [FacultativeService],
  exports: [FacultativeService],
})
export class FacultativeModule {}