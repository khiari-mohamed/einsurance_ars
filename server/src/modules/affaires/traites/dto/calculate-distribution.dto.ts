import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CalculateDistributionDto {
  @ApiProperty({ description: 'Prime nette cédante (déjà nette de la commission cédante) — base de la distribution' })
  @IsNumber()
  @Min(0)
  primeNetteCedante: number;
}