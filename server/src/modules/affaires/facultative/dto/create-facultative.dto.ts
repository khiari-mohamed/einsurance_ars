import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReassuranceType, ModeRenouvellement } from '@prisma/client';

export class GuaranteeLineDto {
  @ApiProperty({ description: 'Libellé de la garantie' })
  @IsString()
  garantie: string;

  @ApiProperty({ description: 'Capitaux assurés 100% pour cette garantie' })
  @IsNumber()
  @Min(0)
  capitauxAssures100: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ordre?: number;
}

export class CreateFacultativeDto {
  @ApiProperty({ description: "ID de l'affaire parente — type FACULTATIVE requis" })
  @IsString()
  affaireId: string;

  @ApiProperty({ enum: ReassuranceType })
  @IsEnum(ReassuranceType)
  reassuranceType: ReassuranceType;

  @ApiProperty({ description: "ID de l'assuré" })
  @IsString()
  assureId: string;

  @ApiPropertyOptional({ description: 'Numéro de police cédante' })
  @IsOptional()
  @IsString()
  numeroPoliceCedante?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paysAssure?: string;

  @ApiPropertyOptional({ description: 'Branche (Incendie, Auto, Transport…)' })
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

  @ApiProperty({ description: 'Prime 100% — base de calcul avant cession' })
  @IsNumber()
  @Min(0)
  prime100Pct: number;

  @ApiPropertyOptional({ description: 'Taux de prime (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tauxPrime?: number;

  @ApiProperty({ description: 'Taux de cession 0–100' })
  @IsNumber()
  @Min(0.0001)
  @Max(100)
  tauxCession: number;

  @ApiPropertyOptional({ description: 'Taux de commission cédante (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tauxCommissionCedante?: number;

  @ApiPropertyOptional({ type: [GuaranteeLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuaranteeLineDto)
  guaranteeLines?: GuaranteeLineDto[];
}