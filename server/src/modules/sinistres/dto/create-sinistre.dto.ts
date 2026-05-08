import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSinistreDto {
  @ApiProperty() @IsString() affaireId: string;
  @IsOptional() @IsString() numerPolice?: string;
  @IsOptional() @IsString() periodeCouverture?: string;
  @ApiProperty() @IsDateString() dateSurvenance: string;
  @IsOptional() @IsNumber() @Min(0) reglementExerciceN?: number;
  @IsOptional() @IsNumber() @Min(0) cumulReglementAnterieurs?: number;
  @IsOptional() @IsNumber() @Min(0) reserves?: number;
  @IsOptional() @IsNumber() @Min(0) partReassureurs?: number;
  @IsOptional() @IsBoolean() appelAuComptant?: boolean;
}