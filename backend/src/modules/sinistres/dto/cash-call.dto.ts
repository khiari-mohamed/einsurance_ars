import { IsString, IsNumber, IsEnum, IsDate, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { CashCallUrgency } from '../cash-call.entity';

export class CreateCashCallDto {
  @IsString()
  sinistreId: string;

  @IsString()
  reassureurId: string;

  @IsNumber()
  montantDemande: number;

  @IsString()
  @IsOptional()
  devise?: string;

  @IsEnum(CashCallUrgency)
  @IsOptional()
  urgence?: CashCallUrgency;

  @IsDate()
  @Type(() => Date)
  dateEcheance: Date;

  @IsString()
  motif: string;

  @IsString()
  @IsOptional()
  justification?: string;
}

export class UpdateCashCallDto {
  @IsNumber()
  @IsOptional()
  montantRecu?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  datePaiement?: Date;

  @IsString()
  @IsOptional()
  referencePaiement?: string;

  @IsString()
  @IsOptional()
  justification?: string;
}

export class AddCommunicationDto {
  @IsEnum(['email', 'phone', 'fax', 'portal'])
  type: 'email' | 'phone' | 'fax' | 'portal';

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  response?: string;
}

export class AddSuiviDto {
  @IsString()
  action: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
