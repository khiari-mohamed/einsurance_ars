import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { BordereauType } from '@prisma/client';

export class GenerateBordereauDto {
  @IsString() affaireId: string;
  @IsEnum(BordereauType) type: BordereauType;
  @IsOptional() @IsString() reassureurId?: string; // for CESSION_REASSUREUR — generates one per reinsurer if omitted
  @IsOptional() @IsDateString() datePeriodeDebut?: string;
  @IsOptional() @IsDateString() datePeriodeFin?: string;
}