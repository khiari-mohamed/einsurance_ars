// FIX (Finances pass): the POST /finances/lettrage body was previously
// three raw @Body('field') params with no class-validator coverage at all —
// `matches` in particular was typed but never validated. Real DTO now.
import { IsString, IsOptional, IsArray, IsNumber, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LettrageMatchItemDto {
  @ApiProperty() @IsString() bordereauId: string;
  @ApiProperty() @IsNumber() @Min(0.001) montant: number;
}

export class CreateLettrageDto {
  @ApiProperty() @IsString() encaissementId: string;

  @ApiProperty({ type: [LettrageMatchItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LettrageMatchItemDto)
  matches: LettrageMatchItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() cedanteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reassureurCode?: string;
}