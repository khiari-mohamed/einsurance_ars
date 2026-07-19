import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';

// Only fields it's safe/sensible to apply identically across many clients at
// once. Deliberately excludes raisonSociale, rne, capital, contacts, etc.
export class BulkUpdateAssuresDataDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pays?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  formeJuridique?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateAssuresDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ type: BulkUpdateAssuresDataDto })
  @ValidateNested()
  @Type(() => BulkUpdateAssuresDataDto)
  data: BulkUpdateAssuresDataDto;
}