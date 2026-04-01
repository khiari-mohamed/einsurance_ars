import { IsInt, Min, Max } from 'class-validator';

export class ClosePeriodDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  exercice: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mois: number;
}
