import { IsDateString, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// All fields optional — unspecified dates default to "day after current
// period ends, +1 year"; unspecified commercial terms carry forward
// unchanged from the version being renewed.
export class RenewTreatyParameterVersionDto {
  @ApiPropertyOptional({ description: 'Défaut : lendemain de la fin de la période active' })
  @IsOptional() @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({ description: 'Défaut : dateDebut + 1 an' })
  @IsOptional() @IsDateString()
  dateFin?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  tauxCommissionCedante?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  tauxCommissionCourtage?: number;

  @IsOptional() @IsNumber() @Min(0)
  plafondGarantie?: number;

  @IsOptional() @IsNumber() @Min(0)
  franchiseAbsolue?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  franchiseRelative?: number;

  @IsOptional() @IsString()
  clauseParticuliere?: string;

  @IsOptional() @IsString()
  motifModification?: string;
}