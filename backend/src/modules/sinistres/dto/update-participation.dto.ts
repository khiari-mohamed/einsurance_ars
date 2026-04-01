import { IsEnum, IsNumber, IsOptional, IsString, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../sinistres.entity';

export class UpdateParticipationDto {
  @IsEnum(PaymentStatus)
  @IsOptional()
  statutPaiement?: PaymentStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montantPaye?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  datePaiement?: Date;

  @IsString()
  @IsOptional()
  referencePaiement?: string;
}
