import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';

export class CreateBankAccountDto {
  @ApiProperty() @IsString() banque: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agence?: string;
  @ApiProperty() @IsString() rib: string;
  @ApiPropertyOptional() @IsOptional() @IsString() swift?: string;
  @ApiProperty({ example: 'TND' }) @IsString() currency: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateCedanteDto {
  @ApiProperty({ description: 'Format: 401200xx (ex: 40120000, 40120001...)' })
  @IsString()
  @Matches(/^401200[0-9]{2}$/, { message: 'Compte comptable doit être au format 401200xx (ex: 40120000)' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;

  // Legacy RNE — kept for compatibility, but replaced by identifiantUnique for new entities
  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;

  @ApiProperty({ description: 'Identifiant unique (7 chiffres + 1 lettre, ex: 1234567A) — obligatoire pour les entités tunisiennes' })
  @IsString()
  @Matches(/^[0-9]{7}[A-Z]$/, { message: 'Identifiant Unique doit être 7 chiffres suivis d\'une lettre majuscule (ex: 1234567A)' })
  identifiantUnique: string;

  @ApiProperty({ description: 'Résident (true = Tunisien, false = non-résident)' })
  @IsBoolean()
  resident: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() formeJuridique?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adresse?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pays?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() capital?: number;
  @ApiPropertyOptional() @IsOptional() freeFields?: Record<string, any>;

  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];

  @ApiPropertyOptional({ type: [CreateBankAccountDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}