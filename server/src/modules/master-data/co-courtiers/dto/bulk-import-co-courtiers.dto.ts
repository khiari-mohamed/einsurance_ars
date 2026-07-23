import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';

export class BulkImportCoCourtierItemDto {
  @IsString()
  raisonSociale: string;

  @IsString()
  compteComptable: string;

  @IsOptional() @IsString()
  identifiantUnique?: string;

  @IsOptional() @IsBoolean()
  resident?: boolean;

  @IsOptional() @IsString()
  rne?: string;

  @IsOptional() @IsString()
  formeJuridique?: string;

  @IsOptional() @IsString()
  adresse?: string;

  @IsOptional() @IsString()
  pays?: string;

  @IsOptional() @IsNumber()
  capital?: number;

  // FIX (new, Co-Courtier pass): was silently dropped on import even though
  // the schema/create-DTO both support it — added for parity.
  @IsOptional() @IsString()
  deviseParDefaut?: string;
}

export class BulkImportCoCourtiersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkImportCoCourtierItemDto)
  items: BulkImportCoCourtierItemDto[];
}