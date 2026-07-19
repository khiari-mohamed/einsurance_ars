import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, ValidateNested,
} from 'class-validator';

export class BulkUpdateReassureursDataDto {
  @IsOptional() @IsString()
  pays?: string;

  @IsOptional() @IsString()
  formeJuridique?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateReassureursDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];

  @ValidateNested()
  @Type(() => BulkUpdateReassureursDataDto)
  data: BulkUpdateReassureursDataDto;
}