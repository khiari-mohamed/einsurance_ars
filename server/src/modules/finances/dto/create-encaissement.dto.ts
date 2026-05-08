import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialPartyType } from '@prisma/client';

export class CreateEncaissementDto {
  @IsOptional() @IsString() affaireId?: string;
  @ApiProperty({ enum: FinancialPartyType }) @IsEnum(FinancialPartyType) partyType: FinancialPartyType;
  @IsOptional() @IsString() cedanteId?: string;
  @IsOptional() @IsString() assureLabel?: string;
  @ApiProperty() @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() tauxRealisation?: number;
  @IsOptional() @IsDateString() dateEncaissement?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() stepNumber?: number;
}