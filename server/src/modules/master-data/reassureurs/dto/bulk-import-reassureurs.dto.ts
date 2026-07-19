import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';

export class BulkImportReassureurItemDto {
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
}

export class BulkImportReassureursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkImportReassureurItemDto)
  items: BulkImportReassureurItemDto[];
}