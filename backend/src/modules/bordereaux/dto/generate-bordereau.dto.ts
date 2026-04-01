import { IsEnum, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { BordereauType } from '../bordereaux.entity';

export class GenerateBordereauDto {
  @IsEnum(BordereauType)
  type: BordereauType;

  @IsUUID()
  cedanteId: string;

  @IsDateString()
  periodStart: Date;

  @IsDateString()
  periodEnd: Date;

  @IsOptional()
  @IsUUID()
  treatyId?: string;

  @IsOptional()
  @IsUUID()
  reassureurId?: string;
}
