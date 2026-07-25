import { IsDateString, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTreatyParameterVersionDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dateFin: string;

  @ApiProperty({ description: 'Taux de commission cédante (%)' })
  @IsNumber() @Min(0) @Max(100)
  tauxCommissionCedante: number;

  @ApiProperty({ description: 'Taux de commission de courtage ARS (%)' })
  @IsNumber() @Min(0) @Max(100)
  tauxCommissionCourtage: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  plafondGarantie?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  franchiseAbsolue?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100)
  franchiseRelative?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  clauseParticuliere?: string;

  @ApiPropertyOptional({ description: 'Motif (optionnel pour la version initiale)' })
  @IsOptional() @IsString()
  motifModification?: string;
}