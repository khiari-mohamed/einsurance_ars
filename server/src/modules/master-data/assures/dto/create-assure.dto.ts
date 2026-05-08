import { IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty() @IsString() nom: string;
  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsString() poste?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() email?: string;
}

export class CreateAssureDto {
  @ApiProperty() @IsString() raisonSociale: string;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsNumber() capital?: number;
  @IsOptional() freeFields?: Record<string, any>;

  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}