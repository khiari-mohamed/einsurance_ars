// FIX (Finances pass): stray extra closing brace at end of file — hard
// compile error, nothing in this module built until this was removed.
import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialPartyType } from '@prisma/client';

export class CreateDecaissementDto {
  @IsOptional() @IsString() affaireId?: string;
  @ApiProperty({ enum: FinancialPartyType }) @IsEnum(FinancialPartyType) partyType: FinancialPartyType;
  @IsOptional() @IsString() reassureurCode?: string;
  @IsOptional() @IsString() coCourtId?: string;
  @ApiProperty() @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tauxReglement?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() stepNumber?: number;
}