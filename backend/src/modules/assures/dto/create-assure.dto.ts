import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAssureDto {
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
  notes?: string;

  @IsString()
  @IsOptional()
  codeComptable?: string;
}
