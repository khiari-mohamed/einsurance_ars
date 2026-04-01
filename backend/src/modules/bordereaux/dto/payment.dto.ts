import { IsNumber, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentMode {
  VIREMENT = 'virement',
  CHEQUE = 'cheque',
  TRAITE = 'traite',
  COMPENSATION = 'compensation',
  AUTRE = 'autre',
}

export class PaymentDto {
  @IsNumber()
  montant: number;

  @IsEnum(PaymentMode)
  modePaiement: PaymentMode;

  @IsDateString()
  datePaiement: string;

  @IsOptional()
  @IsString()
  referenceBancaire?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}