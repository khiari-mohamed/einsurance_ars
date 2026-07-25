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

// NOTE: bulk/download's ZIP generation (ged.service.ts#bulkDownload) needs
// the `archiver` package as a runtime dependency:
//   npm install archiver
//   npm install -D @types/archiver

@Module({
  imports: [
    UploadsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get<number>('app.maxFileSizeMb', 25) * 1024 * 1024 },
      }),
    }),
  ],
  controllers: [GedController],
  providers: [GedService, DocumentChecklistService, ComplianceService, RetentionService, OcrService],
  // FIX: ComplianceService wasn't exported — a future ReportingModule
  // dashboard (or any module wanting to surface GED compliance data
  // alongside other KPIs) had no way to inject it without duplicating the
  // logic. OcrService stays module-internal (only GedService calls it).
  exports: [GedService, DocumentChecklistService, ComplianceService],
})
export class GedModule {}