import {
  IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsArray,
  ValidateNested, IsDateString, Min, Max, ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AffaireType, ModePaiement, ReassuranceType, FormeCouverture,
  ModeRenouvellement, Periodicite, CommissionMode,
} from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

// ── Reinsurer participation line ──────────────────────────────────
export class AffaireReassureurDto {
  @ApiProperty() @IsString() reassureurId: string;
  @ApiProperty({ description: 'Participation % — total = taux de cession en facultative, 100% en traité' })
  @IsNumber() @Min(0.0001) @Max(100) partPct: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLeader?: boolean;
  @ApiPropertyOptional({ enum: CommissionMode }) @IsOptional() @IsEnum(CommissionMode) commissionMode?: CommissionMode;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionArs?: number;
  // FIX (Affaires pass): had no lower bound at all — a negative forfait
  // commission is not a meaningful value in any of the source material and
  // would flow straight into primeNetteReassureur unchecked.
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) commissionForfait?: number;
}

// ── Shared nested DTOs ───────────────────────────────────────────
export class GuaranteeLineDto {
  @ApiProperty() @IsString() garantie: string;
  @ApiProperty() @IsNumber() @Min(0) capitauxAssures100: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() ordre?: number;
}

export class TreatyAccountRubriqueDto {
  @ApiProperty() @IsString() rubrique: string;
  @ApiProperty() @IsString() compteReference: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() ordre?: number;
}

export class PmdInstalmentDto {
  @ApiProperty() @IsNumber() @Min(1) numeroTranche: number;
  @ApiProperty({ example: '2024-03-31' }) @IsDateString() dateEcheance: string;
  @ApiProperty() @IsNumber() @Min(0) montant: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxDeduction?: number;
}

// ── Facultative financial data (Tab B) ───────────────────────────
export class FacultativeDataDto {
  @ApiProperty({ enum: ReassuranceType }) @IsEnum(ReassuranceType) reassuranceType: ReassuranceType;
  @ApiProperty() @IsString() assureId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroPoliceCedante?: string;
  @ApiProperty({ example: '2024-01-01' })
  @IsDateString({}, { message: "La date d'effet est obligatoire et doit être une date valide (AAAA-MM-JJ)" })
  dateEffet: string;
  @ApiProperty({ example: '2025-01-01' })
  @IsDateString({}, { message: "La date d'échéance est obligatoire et doit être une date valide (AAAA-MM-JJ)" })
  dateEcheance: string;
  @ApiPropertyOptional({ enum: ModeRenouvellement }) @IsOptional() @IsEnum(ModeRenouvellement) modeRenouvellement?: ModeRenouvellement;
  @ApiPropertyOptional() @IsOptional() @IsString() paysAssure?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branche?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() produit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() garantie?: string;

  @ApiProperty() @IsNumber() @Min(0) prime100Pct: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tauxPrime?: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) tauxCession: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionCedante?: number;

  @ApiPropertyOptional({ type: [GuaranteeLineDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuaranteeLineDto)
  guaranteeLines?: GuaranteeLineDto[];
}

// ── Treaty financial data (Tab A + B) ────────────────────────────
export class TraiteDataDto {
  @ApiPropertyOptional() @IsOptional() @IsString() referenceTraite?: string;
  @ApiProperty({ enum: ReassuranceType }) @IsEnum(ReassuranceType) reassuranceType: ReassuranceType;
  @ApiPropertyOptional({ enum: FormeCouverture }) @IsOptional() @IsEnum(FormeCouverture) formeCouverture?: FormeCouverture;
  @ApiProperty({ example: '2024-01-01' })
  @IsDateString({}, { message: "La date d'effet est obligatoire et doit être une date valide (AAAA-MM-JJ)" })
  dateEffet: string;
  @ApiProperty({ example: '2025-01-01' })
  @IsDateString({}, { message: "La date d'échéance est obligatoire et doit être une date valide (AAAA-MM-JJ)" })
  dateEcheance: string;
  @ApiPropertyOptional({ enum: ModeRenouvellement }) @IsOptional() @IsEnum(ModeRenouvellement) modeRenouvellement?: ModeRenouvellement;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString({}, { message: "La date d'avis de résiliation doit être une date valide (AAAA-MM-JJ)" })
  dateAvisResiliation?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() zoneGeographique?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branche?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() produit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() garantie?: string;
  @ApiProperty({ enum: Periodicite }) @IsEnum(Periodicite) periodicite: Periodicite;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) primePrevisionnelle?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) pmd?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionCedante?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) commissionLiquidationArs?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) seuilNotification?: number;

  @ApiPropertyOptional({ type: [TreatyAccountRubriqueDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TreatyAccountRubriqueDto)
  accountRubriques?: TreatyAccountRubriqueDto[];

  @ApiPropertyOptional({ type: [PmdInstalmentDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PmdInstalmentDto)
  pmdInstalments?: PmdInstalmentDto[];
}

// ── Main Affaire DTO ──────────────────────────────────────────────
export class CreateAffaireDto {
  @ApiProperty({ enum: AffaireType }) @IsEnum(AffaireType) type: AffaireType;
  @ApiProperty() @IsString() cedanteId: string;
  @ApiPropertyOptional({ enum: ModePaiement }) @IsOptional() @IsEnum(ModePaiement) modePaiement?: ModePaiement;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional({ description: 'Taux de change appliqué (ROE) — devise → TND' })
  @IsOptional() @IsNumber() @Min(0.000001) roe?: number;
  @ApiPropertyOptional({ description: 'Chargé de dossier affiché sur les tableaux de l’affaire' })
  @IsOptional() @IsString() chargeDossier?: string;

  @ApiProperty({ type: [AffaireReassureurDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AffaireReassureurDto)
  reassureurs: AffaireReassureurDto[];

  @ApiPropertyOptional({ type: FacultativeDataDto })
  @IsOptional() @ValidateNested() @Type(() => FacultativeDataDto)
  facultativeData?: FacultativeDataDto;

  @ApiPropertyOptional({ type: TraiteDataDto })
  @IsOptional() @ValidateNested() @Type(() => TraiteDataDto)
  traiteData?: TraiteDataDto;
}