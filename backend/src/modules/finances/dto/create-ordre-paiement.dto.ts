import { IsNotEmpty, IsString, IsEnum, IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentOrderTemplate } from '../ordre-paiement.entity';

class BeneficiaireDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  banque: string;

  @IsString()
  @IsOptional()
  rib?: string;

  @IsString()
  @IsNotEmpty()
  iban: string;

  @IsString()
  @IsOptional()
  bic?: string;

  @IsString()
  @IsNotEmpty()
  adresse: string;

  @IsString()
  @IsNotEmpty()
  pays: string;
}

export class CreateOrdrePaiementDto {
  @IsString()
  @IsNotEmpty()
  decaissementId: string;

  @ValidateNested()
  @Type(() => BeneficiaireDto)
  @IsOptional()
  beneficiaire?: BeneficiaireDto;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montant: number;

  @IsString()
  @IsNotEmpty()
  devise: string;

  @IsString()
  @IsNotEmpty()
  montantLettres: string;

  @IsString()
  @IsNotEmpty()
  objet: string;

  @IsString()
  @IsOptional()
  referenceFacture?: string;

  @IsString()
  @IsOptional()
  referenceAffaire?: string;

  @IsEnum(PaymentOrderTemplate)
  @IsOptional()
  template?: PaymentOrderTemplate;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOrdrePaiementDto {
  @IsString()
  @IsOptional()
  objet?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
