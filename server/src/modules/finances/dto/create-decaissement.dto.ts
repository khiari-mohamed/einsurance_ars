import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { FinancialPartyType } from '@prisma/client';

export class CreateDecaissementDto {
  @IsOptional() @IsString() affaireId?: string;
  @IsEnum(FinancialPartyType) partyType: FinancialPartyType;
  @IsOptional() @IsString() reassureurCode?: string;
  @IsOptional() @IsString() coCourtId?: string;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() tauxReglement?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() stepNumber?: number;
}