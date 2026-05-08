import { IsOptional, IsString, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Periodicite } from '@prisma/client';

export class ReportFilterDto {
  @IsOptional() @IsString() cedanteId?: string;
  @IsOptional() @IsString() reassureurCode?: string;
  @IsOptional() @IsNumber() year?: number;
  @IsOptional() @IsNumber() mois?: number;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsEnum(Periodicite) periodicite?: Periodicite;
}