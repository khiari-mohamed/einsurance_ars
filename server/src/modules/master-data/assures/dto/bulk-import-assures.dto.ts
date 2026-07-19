import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsString,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class BulkImportAssureItemDto {
  @ApiProperty()
  @IsString()
  raisonSociale: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rne?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  formeJuridique?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pays?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  capital?: number;
}

export class BulkImportAssuresDto {
  @ApiProperty({ type: [BulkImportAssureItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportAssureItemDto)
  items: BulkImportAssureItemDto[];
}