import { IsIn, IsNotEmpty, IsOptional, IsString, IsISO8601 } from 'class-validator';

export type ConventionPartnerType = 'CEDANTE' | 'REASSUREUR' | 'CO_COURTIER';

export class AttachConventionDto {
  @IsIn(['CEDANTE', 'REASSUREUR', 'CO_COURTIER'])
  partnerType: ConventionPartnerType;

  @IsString()
  @IsNotEmpty()
  partnerId: string;

  @IsOptional()
  @IsISO8601()
  dateSignature?: string;

  @IsOptional()
  @IsISO8601()
  dateEffet?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}