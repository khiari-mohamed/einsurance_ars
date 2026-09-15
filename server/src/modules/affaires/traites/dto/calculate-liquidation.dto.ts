import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LiquidationInput } from '../treaty-calculator.service';
export class CalculateLiquidationDto implements LiquidationInput {
  @ApiProperty() @IsNumber() @Min(0) primesCedees: number;
  @ApiProperty() @IsNumber() @Min(0) participationsBenefReçues: number;
  @ApiProperty() @IsNumber() @Min(0) interetsSurDepots: number;
  @ApiProperty() @IsNumber() @Min(0) sinistresPayes: number;
  @ApiProperty() @IsNumber() @Min(0) reservesConstituees: number;
  @ApiProperty() @IsNumber() @Min(0) reservesLibereesAnterieur: number;
  @ApiProperty() @IsNumber() @Min(0) commissionCedante: number;
  @ApiProperty() @IsNumber() @Min(0) commissionLiquidationArs: number;
  @ApiProperty() @IsNumber() @Min(0) courtage: number;
  @ApiProperty() @IsNumber() @Min(0) taxes: number;
  @ApiProperty() @IsNumber() @Min(0) pmdDeductible: number;
}