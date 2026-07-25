import { IsNumber, IsPositive, IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class PayBordereauDto {
  @IsNumber() @IsPositive() montant: number;
  @IsEnum(PaymentMode) modePaiement: PaymentMode;
  @IsDateString() datePaiement: string;
  @IsOptional() @IsString() referenceBancaire?: string;
  @IsOptional() @IsString() notes?: string;
}