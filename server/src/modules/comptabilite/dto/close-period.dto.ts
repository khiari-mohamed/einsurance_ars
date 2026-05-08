import { IsNumber, IsOptional } from 'class-validator';
export class ClosePeriodDto {
  @IsNumber() annee: number;
  @IsOptional() @IsNumber() mois?: number;
}