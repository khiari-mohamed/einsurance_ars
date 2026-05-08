import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsNotEmpty, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';

export class CreateReassureurBankAccountDto {
  @IsString() banque: string;
  @IsOptional() @IsString() agence?: string;
  @IsString() rib: string;
  @ApiProperty({ description: 'SWIFT obligatoire pour virements internationaux' })
  @IsString() @IsNotEmpty({ message: 'Code SWIFT obligatoire pour les réassureurs' })
  swift: string;
  @IsString() currency: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateReassureurDto {
  @ApiProperty({ description: 'Format: 401xxxxx' })
  @IsString() @Matches(/^401\d{5}$/, { message: 'Compte comptable doit être au format 401xxxxx' })
  compteComptable: string;

  @IsString() raisonSociale: string;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsNumber() capital?: number;
  @IsOptional() freeFields?: Record<string, any>;

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateReassureurBankAccountDto)
  bankAccounts?: CreateReassureurBankAccountDto[];
}
