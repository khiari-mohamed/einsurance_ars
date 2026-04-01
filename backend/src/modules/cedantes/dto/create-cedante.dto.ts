import { IsString, IsEmail, IsOptional, IsNotEmpty, Matches } from 'class-validator';

export class CreateCedanteDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  raisonSociale: string;

  @IsString()
  @IsOptional()
  formeJuridique?: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsString()
  @IsOptional()
  ville?: string;

  @IsString()
  @IsOptional()
  codePostal?: string;

  @IsString()
  @IsOptional()
  pays?: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  matriculeFiscale?: string;

  @IsString()
  @IsOptional()
  rib?: string;

  @IsString()
  @IsOptional()
  banque?: string;

  @IsString()
  @IsOptional()
  @Matches(/^411\d{5}$/, { message: 'Code comptable auxiliaire must start with 411 followed by 5 digits (e.g., 41100001)' })
  codeComptableAuxiliaire?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
