import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Periodicite } from '@prisma/client';

export class CreateSituationDto {
  @IsString() cedanteId: string;
  @IsOptional() @IsString() traiteId?: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsOptional() @IsEnum(Periodicite) periodicite?: Periodicite;
  @IsOptional() @IsString() currency?: string;
}