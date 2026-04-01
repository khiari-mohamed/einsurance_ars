import { IsString, IsEnum, IsNumber, IsDateString, IsOptional, IsArray, ValidateNested, Min, Max, IsBoolean, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { AffaireCategory, AffaireType, PaymentMode, CommissionCalculMode } from '../affaires.entity';

export class CreateReinsurerDto {
  @IsString()
  reassureurId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  share: number;

  @IsString()
  @IsOptional()
  role?: string;
}

export class CreateAffaireDto {
  @IsEnum(AffaireCategory)
  category: AffaireCategory;

  @IsEnum(AffaireType)
  type: AffaireType;

  @IsString()
  assureId: string;

  @IsString()
  cedanteId: string;

  @IsString()
  @IsOptional()
  coCourtierId?: string;

  @IsString()
  @IsOptional()
  numeroPolice?: string;

  @IsString()
  @IsOptional()
  branche?: string;

  @IsString()
  @IsOptional()
  garantie?: string;

  @IsDateString()
  dateEffet: string;

  @IsDateString()
  dateEcheance: string;

  @IsDateString()
  @IsOptional()
  dateNotification?: string;

  @IsString()
  @IsOptional()
  devise?: string;

  @IsNumber()
  @Min(0)
  capitalAssure100: number;

  @IsNumber()
  @Min(0)
  prime100: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  tauxCession: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tauxCommissionCedante?: number;

  @IsEnum(CommissionCalculMode)
  @IsOptional()
  modeCalculCommissionCedante?: CommissionCalculMode;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tauxCommissionARS?: number;

  @IsEnum(CommissionCalculMode)
  @IsOptional()
  modeCalculCommissionARS?: CommissionCalculMode;

  @IsEnum(PaymentMode)
  @IsOptional()
  paymentMode?: PaymentMode;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReinsurerDto)
  reinsurers: CreateReinsurerDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateIf(o => o.category === 'traitee')
  @IsString()
  treatyType?: string;

  @ValidateIf(o => o.category === 'traitee')
  @IsArray()
  treatyBranches?: string[];

  @ValidateIf(o => o.category === 'traitee')
  @IsArray()
  treatyZones?: string[];

  @ValidateIf(o => o.category === 'traitee')
  @IsString()
  periodiciteComptes?: string;

  @ValidateIf(o => o.category === 'traitee')
  @IsArray()
  rubriquesComptes?: string[];

  @ValidateIf(o => o.category === 'traitee')
  @IsNumber()
  @Min(0)
  primePrevisionnelle?: number;

  @ValidateIf(o => o.category === 'traitee')
  @IsNumber()
  @Min(0)
  pmd?: number;

  @IsNumber()
  @IsOptional()
  montantCommissionCedante?: number;

  @IsNumber()
  @IsOptional()
  montantCommissionARS?: number;
}
