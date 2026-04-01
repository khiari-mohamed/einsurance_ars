import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsDateString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BeneficiaireType } from '../decaissement.entity';
import { ModePaiement } from '../encaissement.entity';

class BanqueBeneficiaireDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  swift: string;

  @IsString()
  @IsNotEmpty()
  iban: string;

  @IsString()
  @IsNotEmpty()
  adresse: string;

  @IsString()
  @IsNotEmpty()
  pays: string;
}

export class CreateDecaissementDto {
  @IsDateString()
  @IsNotEmpty()
  dateDecaissement: string;

  @IsDateString()
  @IsNotEmpty()
  dateValeur: string;

  @IsEnum(BeneficiaireType)
  @IsNotEmpty()
  beneficiaireType: BeneficiaireType;

  @IsString()
  @IsOptional()
  reassureurId?: string;

  @IsString()
  @IsOptional()
  cedanteId?: string;

  @IsString()
  @IsOptional()
  courtierId?: string;

  @ValidateNested()
  @Type(() => BanqueBeneficiaireDto)
  @IsOptional()
  banqueBeneficiaire?: BanqueBeneficiaireDto;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montant: number;

  @IsString()
  @IsNotEmpty()
  devise: string;

  @IsNumber()
  @IsOptional()
  tauxChange?: number;

  @IsNumber()
  @IsOptional()
  fraisBancaires?: number;

  @IsEnum(ModePaiement)
  @IsNotEmpty()
  modePaiement: ModePaiement;

  @IsString()
  @IsOptional()
  referenceSwift?: string;

  @IsNumber()
  @IsOptional()
  commissionARS?: number;

  @IsNumber()
  @IsOptional()
  commissionCedante?: number;

  @IsString()
  @IsOptional()
  affaireId?: string;

  @IsString()
  @IsOptional()
  sinistreId?: string;

  @IsString()
  @IsOptional()
  bordereauId?: string;

  @IsString()
  @IsOptional()
  situationId?: string;

  @IsString()
  @IsOptional()
  compteBancaireDebite?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
