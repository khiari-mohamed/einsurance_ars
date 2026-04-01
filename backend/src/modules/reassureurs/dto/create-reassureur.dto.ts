import { IsString, IsEmail, IsOptional, IsNotEmpty, Matches } from 'class-validator';

export class CreateReassureurDto {
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
  swift?: string;

  @IsString()
  @IsOptional()
  iban?: string;

  @IsString()
  @IsOptional()
  banque?: string;

  @IsString()
  @IsOptional()
  @Matches(/^401\d{5}$/, { message: 'Code comptable auxiliaire must start with 401 followed by 5 digits (e.g., 40100001)' })
  codeComptableAuxiliaire?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
