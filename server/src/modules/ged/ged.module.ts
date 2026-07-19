import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { GedController } from './ged.controller';
import { GedService } from './ged.service';
import { DocumentChecklistService } from './document-checklist.service';
import { ComplianceService } from './compliance.service';
import { RetentionService } from './retention.service';
import { OcrService } from './ocr.service';
import { UploadsModule } from '../upload/uploads.module';

@Module({
  imports: [
    UploadsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        // FIX: previously no limit at all — an oversized file was fully
        // buffered into memory before FileValidationPipe rejected it inside
        // UploadsService. Now rejected by Multer itself, before buffering.
        limits: { fileSize: config.get<number>('app.maxFileSizeMb', 25) * 1024 * 1024 },
      }),
    }),
  ],
  controllers: [GedController],
  providers: [GedService, DocumentChecklistService, ComplianceService, RetentionService, OcrService],
  exports: [GedService, DocumentChecklistService],
})
export class GedModule {}