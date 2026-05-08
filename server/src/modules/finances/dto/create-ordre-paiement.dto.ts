import { IsString, IsOptional, IsNumber, IsArray, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrdrePaiementDto {
  @ApiProperty() @IsString() beneficiaire: string;
  @IsOptional() @IsString() bankAccountId?: string;
  @ApiProperty() @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() referenceAffaire?: string;
  @IsOptional() @IsString() referenceBordereau?: string;
  @IsOptional() @IsDateString() dateExecution?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) signataires?: string[];
}