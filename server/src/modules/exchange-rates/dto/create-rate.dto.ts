import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD' }) @IsString() code: string;
  @ApiProperty({ example: 'Dollar Américain' }) @IsString() label: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateRateDto {
  @ApiProperty({ example: 'USD' }) @IsString() currencyCode: string;
  @ApiProperty({ example: 3.125 }) @IsNumber() tauxRealisation: number;
  @IsOptional() @IsNumber() tauxReglement?: number;
  @ApiProperty({ example: '2024-01-15' }) @IsDateString() dateEffet: string;
  @IsOptional() @IsBoolean() isMonthly?: boolean;
}