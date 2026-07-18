import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';

export class CreateBankAccountDto {
  @ApiProperty() @IsString() banque: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agence?: string;
  @ApiProperty() @IsString() rib: string;

  // FIX: was missing — real reassureur/cedante data includes IBAN separately from RIB
  // (audit Découverte 3: 33/35 réassureurs already have IBAN data ready to import).
  @ApiPropertyOptional({ description: 'IBAN (optionnel pour compte tunisien, courant pour comptes internationaux)' })
  @IsOptional() @IsString() iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() swift?: string;
  @ApiProperty({ example: 'TND' }) @IsString() currency: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateCedanteDto {
  // FIX: was /^401200[0-9]{2}$/ — rejected EVERY real cédante account on file.
  // Audit Découverte 2 real codes: STAR=40124000, ASTREE=40127000, CARTE=40128000,
  // HAYETT=40129000, LLOYD=40122000, BIAT ASSURANCES=40121400, MAGHREBIA=40123000...
  // Real fixed prefix is "4012" (general account 40120000 = FOURNISSEURS COMPAGNIES
  // D'ASSURANCE), followed by 4 free digits — not "401200" + 2 digits.
  @ApiProperty({ description: 'Format: 4012xxxx (ex: 40124000, 40127000...)' })
  @IsString()
  @Matches(/^4012[0-9]{4}$/, { message: 'Compte comptable doit être au format 4012xxxx (ex: 40124000)' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;

  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;

  // FIX: was mandatory (@IsString(), no @IsOptional()) — blocked creation of ALL 20
  // known real cédantes, since none have this field populated anywhere in the source
  // data (RNE-family fields sit at 0% across all 119 tiers — audit Bloquant 1). This
  // field isn't sourced in the CDC / PR24 / consolidated doc either — worth confirming
  // its business justification with the client. The actual business rule (mandatory
  // only when resident = true) is enforced in CedantesService — this DTO just stops
  // blocking valid input before the service ever runs.
  @ApiPropertyOptional({ description: 'Identifiant unique (7 chiffres + 1 lettre, ex: 1234567A) — obligatoire pour les entités tunisiennes (voir service)' })
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

  @ApiPropertyOptional({ type: [CreateBankAccountDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}