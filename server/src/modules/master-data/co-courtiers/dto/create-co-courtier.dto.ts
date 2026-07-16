import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';
import { CreateBankAccountDto } from '../../cedantes/dto/create-cedante.dto';

export class CreateCoCourtierDto {
  @ApiProperty({ description: 'Format: 401xxxxx (ex: 40130000, 40130001...)' })
  @IsString()
  @Matches(/^401[0-9]{5}$/, { message: 'Compte comptable doit être au format 401xxxxx (ex: 40130000)' })
  compteComptable: string;

  @ApiProperty() @IsString() raisonSociale: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rne?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formeJuridique?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adresse?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pays?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() capital?: number;
  @ApiPropertyOptional() @IsOptional() freeFields?: Record<string, any>;

  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];

  @ApiPropertyOptional({ type: [CreateBankAccountDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}