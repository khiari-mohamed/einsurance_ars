import { IsEnum, IsOptional, IsDateString, IsArray, IsString } from 'class-validator';
import { IntegrationExportFormat } from '@prisma/client';
export class ExportEntriesDto {
  @IsEnum(IntegrationExportFormat) format: IntegrationExportFormat;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) entryIds?: string[];
}