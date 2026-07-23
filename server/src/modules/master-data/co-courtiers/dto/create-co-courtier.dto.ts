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

  // Confirmed — Co-Courtier is structurally identical to Reassureur (CDC 5.7),
  // including identifiantUnique and resident. Matches the corrected schema.
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

  // FIX (new, Co-Courtier pass): existed on the schema (@default("TND")) but
  // was never exposed on the DTO — silently unsettable from create/update.
  // Mirrors the field on Assure/Cedante/Reassureur.
  @ApiPropertyOptional({ description: 'Devise par défaut (ex: TND, EUR, USD)', default: 'TND' })
  @IsOptional() @IsString() deviseParDefaut?: string;

  // FIX (new, Co-Courtier pass): admin/dedup-script field, see schema comment.
  // Deliberately NOT surfaced in the day-to-day create/edit UI — CDC §12.2
  // still marks the dual-code resolution strategy as "❌ à décider".
  @ApiPropertyOptional({ description: "Clé de regroupement pour lier deux codes (401xxxxx / 411xxxxx) d'une même entité — usage interne/admin, dédoublonnage" })
  @IsOptional() @IsString() groupKey?: string;

  @ApiPropertyOptional() @IsOptional() freeFields?: Record<string, any>;

  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];

  @ApiPropertyOptional({ type: [CreateBankAccountDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}