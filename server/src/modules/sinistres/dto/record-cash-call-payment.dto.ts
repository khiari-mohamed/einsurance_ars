import { IsNumber, Min } from 'class-validator';

export class RecordCashCallPaymentDto {
  @IsNumber() @Min(0) montantRecu: number;
}