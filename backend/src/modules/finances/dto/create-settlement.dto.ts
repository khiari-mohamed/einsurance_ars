import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsDateString, Min, ValidateNested, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';
import { SettlementType } from '../settlement.entity';

export class CreateSettlementDto {
  @IsEnum(SettlementType)
  @IsNotEmpty()
  type: SettlementType;

  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @IsDateString()
  @IsNotEmpty()
  dateFin: string;

  @IsString()
  @IsNotEmpty()
  cedanteId: string;

  @IsString()
  @IsOptional()
  reassureurId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSettlementDto {
  @IsEnum(SettlementType)
  @IsOptional()
  type?: SettlementType;

  @IsString()
  @IsOptional()
  notes?: string;
}
