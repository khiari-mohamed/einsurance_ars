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

// Only fields safe to apply identically across many cédantes at once.
// Deliberately excludes compteComptable (locked after creation),
// identifiantUnique/resident (cross-field business rule + per-row
// uniqueness), and rne (per-row uniqueness).
export class BulkUpdateCedantesDataDto {
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

export class BulkUpdateCedantesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ type: BulkUpdateCedantesDataDto })
  @ValidateNested()
  @Type(() => BulkUpdateCedantesDataDto)
  data: BulkUpdateCedantesDataDto;
}