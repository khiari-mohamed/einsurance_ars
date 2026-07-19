import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Matches,
} from 'class-validator';

// Mirrors CreateCedanteDto's field-level format rules (same regex, same
// messages) minus contacts/bankAccounts, which don't come from a flat
// spreadsheet row. The resident-requires-identifiantUnique cross-field rule
// is enforced in the service, same as single create.
export class BulkImportCedanteItemDto {
  @ApiProperty()
  @IsString()
  raisonSociale: string;

  @ApiProperty({ description: 'Format: 4012xxxx (ex: 40124000, 40127000...)' })
  @IsString()
  @Matches(/^4012[0-9]{4}$/, { message: 'Compte comptable doit être au format 4012xxxx (ex: 40124000)' })
  compteComptable: string;

  @ApiPropertyOptional({ description: 'Identifiant unique (7 chiffres + 1 lettre, ex: 1234567A) — obligatoire pour les entités tunisiennes' })
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
  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;
}

export class BulkImportCedantesDto {
  @ApiProperty({ type: [BulkImportCedanteItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportCedanteItemDto)
  items: BulkImportCedanteItemDto[];
}