import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateExportDto {
  @ApiPropertyOptional({ enum: ['SAGE', 'CSV_GENERIC'], default: 'SAGE' })
  @IsOptional() @IsIn(['SAGE', 'CSV_GENERIC'])
  format?: 'SAGE' | 'CSV_GENERIC';

  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codeJournal?: string;
}