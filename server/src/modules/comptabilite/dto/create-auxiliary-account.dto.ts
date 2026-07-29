// FIX (Comptabilité pass): controller previously accepted `data: any` with
// zero validation on this route.
import { IsString, IsOptional } from 'class-validator';

export class CreateAuxiliaryAccountDto {
  @IsString() planComptableId: string;
  @IsString() code: string;
  @IsString() libelle: string;
  @IsOptional() @IsString() cedanteId?: string;
  @IsOptional() @IsString() reassureurId?: string;
}