import { Module, forwardRef } from '@nestjs/common';
import { FacultativeController } from './facultative.controller';
import { FacultativeService } from './facultative.service';
import { AffairesModule } from '../../affaires/affaires.module';

@Module({
  imports: [forwardRef(() => AffairesModule)],
  controllers: [FacultativeController],
  providers: [FacultativeService],
  exports: [FacultativeService],
})
export class FacultativeModule {}