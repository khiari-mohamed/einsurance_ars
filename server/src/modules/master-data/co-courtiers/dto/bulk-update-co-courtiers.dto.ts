import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, ValidateNested,
} from 'class-validator';

export class BulkUpdateCoCourtiersDataDto {
  @IsOptional() @IsString()
  pays?: string;

  @IsOptional() @IsString()
  formeJuridique?: string;

  // FIX (new, Co-Courtier pass): exposed for bulk edit — e.g. re-pointing a
  // batch of foreign co-courtiers to EUR after an initial TND-default import.
  @IsOptional() @IsString()
  deviseParDefaut?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateCoCourtiersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];

  @ValidateNested()
  @Type(() => BulkUpdateCoCourtiersDataDto)
  data: BulkUpdateCoCourtiersDataDto;
}