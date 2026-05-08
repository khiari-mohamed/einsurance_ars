import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecoveryMethod } from '@prisma/client';

export class UpdateSinistreDto {
  @IsOptional() @IsNumber() @Min(0) reglementExerciceN?: number;
  @IsOptional() @IsNumber() @Min(0) cumulReglementAnterieurs?: number;
  @IsOptional() @IsNumber() @Min(0) reserves?: number;
  @IsOptional() @IsNumber() @Min(0) partReassureurs?: number;
  @IsOptional() @IsString() periodeCouverture?: string;
  @IsOptional() @IsString() numerPolice?: string;
  @IsOptional() @IsEnum(RecoveryMethod) recoveryMethod?: RecoveryMethod;
}