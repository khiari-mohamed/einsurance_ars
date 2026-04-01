import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { SourceType, ModePaiement } from '../encaissement.entity';

export class CreateEncaissementDto {
  @IsDateString()
  @IsNotEmpty()
  dateEncaissement: string;

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

  @IsEnum(SourceType)
  @IsNotEmpty()
  sourceType: SourceType;

  @IsString()
  @IsOptional()
  cedanteId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  reassureurId?: string;

  @IsString()
  @IsOptional()
  courtierId?: string;

  @IsEnum(ModePaiement)
  @IsNotEmpty()
  modePaiement: ModePaiement;

  @IsString()
  @IsNotEmpty()
  referencePaiement: string;

  @IsString()
  @IsOptional()
  banqueEmettrice?: string;

  @IsString()
  @IsOptional()
  bordereauId?: string;

  @IsString()
  @IsOptional()
  affaireId?: string;

  @IsString()
  @IsOptional()
  compteBancaireId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
