import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';

export class CreateBankAccountDto {
  @ApiProperty() @IsString() banque: string;
  @IsOptional() @IsString() agence?: string;
  @ApiProperty() @IsString() rib: string;
  @IsOptional() @IsString() swift?: string;
  @ApiProperty({ example: 'TND' }) @IsString() currency: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateCedanteDto {
  @ApiProperty({ description: 'Format: 411xxxxx' })
  @IsString()
  @Matches(/^411\d{5}$/, { message: 'Compte comptable doit être au format 411xxxxx' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsNumber() capital?: number;
  @IsOptional() freeFields?: Record<string, any>;

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}