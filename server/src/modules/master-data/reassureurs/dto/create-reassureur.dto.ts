import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';

export class CreateReassureurBankAccountDto {
  @ApiProperty() @IsString() banque: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agence?: string;
  @ApiProperty() @IsString() rib: string;

  // FIX: was missing — 33/35 réassureurs already have real IBAN data (audit Découverte 3).
  @ApiPropertyOptional({ description: 'IBAN — courant pour les réassureurs internationaux' })
  @IsOptional() @IsString() iban?: string;

  // FIX: @ApiProperty() told Swagger this was required while @IsOptional() said it
  // wasn't — generated API docs contradicted the actual validation. Now consistent:
  // genuinely optional at the DTO level. The resident-based business rule is enforced
  // in ReassureursService as a NON-BLOCKING flag (see create()/update() below) — the
  // hard block was removed because 3 real named non-resident reassureurs (TUNIS RE,
  // AIG, LIBYA INSURANCE — audit Découverte 3) currently lack SWIFT in the client's
  // own accounting file. Question 5.6.3 (obligatoire ou optionnel ?) is still open.
  @ApiPropertyOptional({ description: 'SWIFT/BIC — normalement attendu pour les réassureurs non-résidents' })
  @IsOptional() @IsString() swift?: string;

  @ApiProperty({ example: 'TND' }) @IsString() currency: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateReassureurDto {
  @ApiProperty({ description: 'Format: 401xxxxx (ex: 40130000, 40130001...)' })
  @IsString()
  @Matches(/^401[0-9]{5}$/, { message: 'Compte comptable doit être au format 401xxxxx (ex: 40130000)' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;

  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;

  @ApiPropertyOptional({ description: 'Identifiant unique (7 chiffres + 1 lettre) — obligatoire pour les entités tunisiennes, optionnel pour étrangers' })
  @IsOptional()
  @Matches(/^[0-9]{7}[A-Z]$/, { message: "Identifiant Unique doit être 7 chiffres suivis d'une lettre majuscule (ex: 1234567A)" })
  identifiantUnique?: string;

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

  @ApiPropertyOptional({ type: [CreateReassureurBankAccountDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateReassureurBankAccountDto)
  bankAccounts?: CreateReassureurBankAccountDto[];
}