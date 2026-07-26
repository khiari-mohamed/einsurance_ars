import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialMovementType } from '@prisma/client';

export class ImportBankMovementDto {
  @ApiProperty({ enum: FinancialMovementType }) @IsEnum(FinancialMovementType) type: FinancialMovementType;
  @ApiProperty() @IsNumber() @Min(0) montant: number;
  @ApiProperty() @IsString() currency: string;
  @ApiProperty() @IsDateString() dateValeur: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}