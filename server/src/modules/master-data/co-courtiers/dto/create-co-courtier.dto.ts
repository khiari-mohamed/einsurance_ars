import { IsString, IsOptional, IsNumber, ValidateNested, Matches, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateContactDto } from '../../assures/dto/create-assure.dto';
import { CreateBankAccountDto } from '../../cedantes/dto/create-cedante.dto';

export class CreateCoCourtierDto {
  @IsString() @Matches(/^\d{8}$/, { message: 'Compte comptable 8 chiffres requis' })
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

  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateBankAccountDto)
  bankAccounts?: CreateBankAccountDto[];
}