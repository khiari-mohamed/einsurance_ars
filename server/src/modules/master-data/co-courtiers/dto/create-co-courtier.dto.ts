import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';
import { CreateBankAccountDto } from '../../cedantes/dto/create-cedante.dto';

export class CreateCoCourtierDto {
  @ApiProperty({ description: 'Format: 401xxxxx (ex: 40130000, 40130001...)' })
  @IsString()
  @Matches(/^401[0-9]{5}$/, { message: 'Compte comptable doit être au format 401xxxxx (ex: 40130000)' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;

  // FIX (ASSUMES SCHEMA ADDITION — CONFIRM): Section 5.7 says Co-Courtier is
  // "identique au Réassureur" structurally. Cedante/Reassureur both carry
  // identifiantUnique + resident; CoCourtier was inconsistent (missing both) even
  // though co-brokers can equally be Tunisian or foreign (open question 5.6.4).
  // *** Assumes your corrected schema added `identifiantUnique` and `resident`
  // columns to the CoCourtier model. If it didn't, strip these two fields + the
  // matching service logic before compiling. ***
  @ApiPropertyOptional({ description: 'Identifiant unique (7 chiffres + 1 lettre) — obligatoire pour les entités tunisiennes' })
  @IsOptional()
  @Matches(/^[0-9]{7}[A-Z]$/, { message: "Identifiant Unique doit être 7 chiffres suivis d'une lettre majuscule (ex: 1234567A)" })
  identifiantUnique?: string;

  @ApiPropertyOptional({ description: 'Résident (true = Tunisien, false = non-résident)' })
  @IsOptional() @IsBoolean() resident?: boolean;

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