import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyParameters } from './company-parameters.entity';
import { BackupService } from './backup.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyParameters]),
    SharedModule,
  ],
  providers: [BackupService],
  exports: [BackupService],
})
export class SystemModule {}
