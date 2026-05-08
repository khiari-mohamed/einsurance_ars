import {
  IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyContactDto {
  @IsString() nom: string;
  @IsOptional() @IsString() poste?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() email?: string;
}

export class CreateCompanyBankAccountDto {
  @IsString() banque: string;
  @IsOptional() @IsString() agence?: string;
  @IsString() rib: string;
  @IsOptional() @IsString() swift?: string;
  @IsString() currency: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateCompanyFreeFieldDto {
  @IsString() label: string;
  @IsOptional() @IsString() valeur?: string;
  @IsOptional() @IsNumber() ordre?: number;
}

export class CreateCompanyDto {
  @ApiProperty() @IsString() raisonSociale: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() codePostal?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsNumber() capitalSocial?: number;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() objetSocial?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) representantsLegaux?: string[];
  @IsOptional() @IsString() matriculeFiscal?: string;
  @IsOptional() @IsString() regimeFiscal?: string;
  @IsOptional() @IsBoolean() assujettieATVA?: boolean;
  @IsOptional() @IsNumber() tauxTVA?: number;
  @IsOptional() @IsString() autresTaxes?: string;

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateCompanyContactDto)
  contacts?: CreateCompanyContactDto[];

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateCompanyBankAccountDto)
  bankAccounts?: CreateCompanyBankAccountDto[];

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateCompanyFreeFieldDto)
  freeFields?: CreateCompanyFreeFieldDto[];
}