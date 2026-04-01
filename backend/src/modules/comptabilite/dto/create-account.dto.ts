import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { AccountType, AccountClass } from '../plan-comptable.entity';

export class CreateAccountDto {
  @IsString()
  code: string;

  @IsString()
  libelle: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsEnum(AccountClass)
  classe: AccountClass;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsBoolean()
  isAuxiliary?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
