import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GedController } from './ged.controller';
import { GedService } from './ged.service';
import { DocumentChecklistService } from './document-checklist.service';
import { ComplianceService } from './compliance.service';
import { RetentionService } from './retention.service';
import { OcrService } from './ocr.service';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [GedController],
  providers: [GedService, DocumentChecklistService, ComplianceService, RetentionService, OcrService],
  exports: [GedService, DocumentChecklistService],
})
export class GedModule {}