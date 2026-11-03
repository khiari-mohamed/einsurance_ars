import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NonProportionalLineDto {
  @ApiProperty() @IsNumber() @Min(0) priorite: number;
  @ApiProperty() @IsNumber() @Min(0) pmd: number;
  @ApiProperty() @IsNumber() @Min(0.0001) portee: number;
  @ApiProperty({ description: 'Expected premium income (EPI)' }) @IsNumber() @Min(0) epi: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) tauxPrime: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionCedante?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tauxCommissionArs?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) ordre?: number;
}
