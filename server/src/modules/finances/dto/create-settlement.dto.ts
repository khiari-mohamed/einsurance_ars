import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';
import { SettlementMode } from '@prisma/client';

export class CreateSettlementDto {
  @IsEnum(SettlementMode) mode: SettlementMode;
  @IsOptional() @IsString() affaireId?: string;
  @IsOptional() @IsString() situationId?: string;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() tauxRealisation?: number;
  @IsOptional() @IsNumber() tauxReglement?: number;
  @IsOptional() @IsDateString() dateSettlement?: string;
}