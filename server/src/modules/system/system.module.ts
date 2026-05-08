import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { BackupService } from './backup.service';
import { ImportExportService } from './import-export.service';
import { PrinterService } from './printer.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService, BackupService, ImportExportService, PrinterService],
  exports: [CompanyService],
})
export class SystemModule {}