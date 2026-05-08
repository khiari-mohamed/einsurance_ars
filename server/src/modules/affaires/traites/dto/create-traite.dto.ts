import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReassuranceType,
  FormeCouverture,
  ModeRenouvellement,
  Periodicite,
} from '@prisma/client';

export class TreatyAccountRubriqueDto {
  @ApiProperty({ description: 'Branche / rubrique (Incendie, Vol…)' })
  @IsString()
  rubrique: string;

  @ApiProperty({ description: 'Code de compte mappé à cette rubrique' })
  @IsString()
  compteReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ordre?: number;
}

export class PmdInstalmentDto {
  @ApiProperty({ description: 'Numéro de la tranche (1, 2, 3…)' })
  @IsNumber()
  @Min(1)
  numeroTranche: number;

  @ApiProperty({ example: '2024-03-31' })
  @IsDateString()
  dateEcheance: string;

  @ApiProperty({ description: 'Montant de la tranche' })
  @IsNumber()
  @Min(0)
  montant: number;

  @ApiPropertyOptional({ description: 'Taux de déduction PMD (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tauxDeduction?: number;
}

export class CreateTraiteDto {
  @ApiProperty({ description: "ID de l'affaire parente — type TRAITE requis" })
  @IsString()
  affaireId: string;

  @ApiPropertyOptional({ description: 'Référence interne du traité' })
  @IsOptional()
  @IsString()
  referenceTraite?: string;

  @ApiProperty({ enum: ReassuranceType })
  @IsEnum(ReassuranceType)
  reassuranceType: ReassuranceType;

  @ApiPropertyOptional({ enum: FormeCouverture })
  @IsOptional()
  @IsEnum(FormeCouverture)
  formeCouverture?: FormeCouverture;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  dateEffet: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  dateEcheance: string;

  @ApiPropertyOptional({ enum: ModeRenouvellement })
  @IsOptional()
  @IsEnum(ModeRenouvellement)
  modeRenouvellement?: ModeRenouvellement;

  @ApiPropertyOptional({ description: "Date d'avis de résiliation" })
  @IsOptional()
  @IsDateString()
  dateAvisResiliation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zoneGeographique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branche?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  produit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  garantie?: string;

  @ApiProperty({ enum: Periodicite, default: Periodicite.TRIMESTRIELLE })
  @IsEnum(Periodicite)
  periodicite: Periodicite;

  @ApiPropertyOptional({ description: 'Prime prévisionnelle annuelle' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  primePrevisionnelle?: number;

  @ApiPropertyOptional({ description: 'Prime Minimum et Dépôt (PMD)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pmd?: number;

  @ApiPropertyOptional({ description: 'Taux de commission cédante (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tauxCommissionCedante?: number;

  @ApiPropertyOptional({ description: 'Commission à la liquidation ARS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionLiquidationArs?: number;

  @ApiPropertyOptional({
    description: 'Seuil de notification sinistres aux réassureurs',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seuilNotification?: number;

  @ApiPropertyOptional({ type: [TreatyAccountRubriqueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatyAccountRubriqueDto)
  accountRubriques?: TreatyAccountRubriqueDto[];

  @ApiPropertyOptional({ type: [PmdInstalmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmdInstalmentDto)
  pmdInstalments?: PmdInstalmentDto[];
}