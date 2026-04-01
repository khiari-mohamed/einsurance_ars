import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, Min, IsDecimal, Max } from 'class-validator';
import { CommissionType, CalculationBase } from '../commission.entity';

export class CreateCommissionDto {
  @IsEnum(CommissionType)
  @IsNotEmpty()
  type: CommissionType;

  @IsString()
  @IsNotEmpty()
  affaireId: string;

  @IsString()
  @IsOptional()
  bordereauId?: string;

  @IsString()
  @IsOptional()
  cedanteId?: string;

  @IsString()
  @IsOptional()
  courtierId?: string;

  @IsEnum(CalculationBase)
  @IsNotEmpty()
  baseCalcul: CalculationBase;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  baseMontant: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  taux: number; // Percentage

  @IsNumber()
  @IsOptional()
  montant?: number; // If provided, override calculation

  @IsNumber()
  @IsOptional()
  tauxMax?: number;

  @IsString()
  @IsOptional()
  overrideReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCommissionDto {
  @IsNumber()
  @IsOptional()
  taux?: number;

  @IsNumber()
  @IsOptional()
  montant?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
