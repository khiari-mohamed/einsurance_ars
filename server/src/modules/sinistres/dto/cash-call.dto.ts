import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
export class CreateCashCallDto {
  @IsNumber() @Min(0) montantDemande: number;
  @IsOptional() @IsString() notes?: string;
}