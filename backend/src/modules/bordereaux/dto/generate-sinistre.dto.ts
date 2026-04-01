import { IsUUID, IsDateString } from 'class-validator';

export class GenerateSinistreDto {
  @IsUUID()
  sinistreId: string;

  @IsUUID()
  cedanteId: string;

  @IsDateString()
  dateEmission: string;
}
