import {
  IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsArray,
  ValidateNested, IsDateString, Min, Max, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AffaireType, ModePaiement, ReassuranceType, FormeCouverture,
  ModeRenouvellement, Periodicite, CommissionMode,
} from '@prisma/client';

// ── Reinsurer participation line ──────────────────────────────────
export class AffaireReassureurDto {
  @ApiProperty() @IsString() reassureurId: string;
  @ApiProperty({ description: 'Participation % — total toutes lignes = 100' })
  @IsNumber() @Min(0.0001) @Max(100) partPct: number;
  @IsOptional() @IsBoolean() isLeader?: boolean;
  @IsOptional() @IsEnum(CommissionMode) commissionMode?: CommissionMode;
  @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionArs?: number;
  @IsOptional() @IsNumber() commissionForfait?: number;
}

// ── Facultative financial data (Tab B) ───────────────────────────
export class FacultativeDataDto {
  @IsEnum(ReassuranceType) reassuranceType: ReassuranceType;
  @IsString() assureId: string;
  @IsOptional() @IsString() numeroPoliceCedante?: string;
  @IsDateString() dateEffet: string;
  @IsDateString() dateEcheance: string;
  @IsOptional() @IsEnum(ModeRenouvellement) modeRenouvellement?: ModeRenouvellement;
  @IsOptional() @IsString() paysAssure?: string;
  @IsOptional() @IsString() branche?: string;
  @IsOptional() @IsString() produit?: string;
  @IsOptional() @IsString() garantie?: string;

  @IsNumber() @Min(0) prime100Pct: number;
  @IsOptional() @IsNumber() tauxPrime?: number;
  @IsNumber() @Min(0) @Max(100) tauxCession: number;
  @IsOptional() @IsNumber() tauxCommissionCedante?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuaranteeLineDto)
  guaranteeLines?: GuaranteeLineDto[];
}

export class GuaranteeLineDto {
  @IsString() garantie: string;
  @IsNumber() @Min(0) capitauxAssures100: number;
  @IsOptional() @IsNumber() ordre?: number;
}

// ── Treaty financial data (Tab A + B) ────────────────────────────
export class TraiteDataDto {
  @IsOptional() @IsString() referenceTraite?: string;
  @IsEnum(ReassuranceType) reassuranceType: ReassuranceType;
  @IsOptional() @IsEnum(FormeCouverture) formeCouverture?: FormeCouverture;
  @IsDateString() dateEffet: string;
  @IsDateString() dateEcheance: string;
  @IsOptional() @IsEnum(ModeRenouvellement) modeRenouvellement?: ModeRenouvellement;
  @IsOptional() @IsDateString() dateAvisResiliation?: string;
  @IsOptional() @IsString() zoneGeographique?: string;
  @IsOptional() @IsString() branche?: string;
  @IsOptional() @IsString() produit?: string;
  @IsOptional() @IsString() garantie?: string;
  @IsEnum(Periodicite) periodicite: Periodicite;

  @IsOptional() @IsNumber() primePrevisionnelle?: number;
  @IsOptional() @IsNumber() pmd?: number;
  @IsOptional() @IsNumber() tauxCommissionCedante?: number;
  @IsOptional() @IsNumber() commissionLiquidationArs?: number;
  @IsOptional() @IsNumber() seuilNotification?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TreatyAccountRubriqueDto)
  accountRubriques?: TreatyAccountRubriqueDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PmdInstalmentDto)
  pmdInstalments?: PmdInstalmentDto[];
}

export class TreatyAccountRubriqueDto {
  @IsString() rubrique: string;
  @IsString() compteReference: string;
  @IsOptional() @IsNumber() ordre?: number;
}

export class PmdInstalmentDto {
  @IsNumber() @Min(1) numeroTranche: number;
  @IsDateString() dateEcheance: string;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsNumber() tauxDeduction?: number;
}

// ── Main Affaire DTO ──────────────────────────────────────────────
export class CreateAffaireDto {
  @ApiProperty({ enum: AffaireType }) @IsEnum(AffaireType) type: AffaireType;
  @ApiProperty() @IsString() cedanteId: string;
  @IsOptional() @IsEnum(ModePaiement) modePaiement?: ModePaiement;
  @IsOptional() @IsString() currency?: string;

  @ApiProperty({ type: [AffaireReassureurDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AffaireReassureurDto)
  reassureurs: AffaireReassureurDto[];

  @IsOptional() @ValidateNested() @Type(() => FacultativeDataDto)
  facultativeData?: FacultativeDataDto;

  @IsOptional() @ValidateNested() @Type(() => TraiteDataDto)
  traiteData?: TraiteDataDto;
}