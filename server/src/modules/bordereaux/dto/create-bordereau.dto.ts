import {
  IsString, IsEnum, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BordereauType } from '@prisma/client';

export class BordereauLineDto {
  @IsString() libelle: string;
  @IsOptional() @IsString() couverture?: string;
  @IsOptional() @IsDateString() periodeDebut?: string;
  @IsOptional() @IsDateString() periodeFin?: string;
  @IsOptional() @IsNumber() capitaux100?: number;
  @IsOptional() @IsNumber() prime100?: number;
  @IsOptional() @IsNumber() tauxCession?: number;
  @IsOptional() @IsNumber() primeBrute?: number;
  @IsOptional() @IsNumber() commissionCedante?: number;
  @IsOptional() @IsNumber() commissionCourtage?: number;
  @IsOptional() @IsNumber() primeNette?: number;
  @IsOptional() @IsNumber() sinistresPayes?: number;
  @IsOptional() @IsNumber() recConstitues?: number;
  @IsOptional() @IsNumber() sapConstitues?: number;
  @IsOptional() @IsNumber() taxes?: number;
  @IsOptional() @IsNumber() primesCedees?: number;
  @IsOptional() @IsNumber() recLiberes?: number;
  @IsOptional() @IsNumber() sapLiberes?: number;
  @IsOptional() @IsNumber() interets?: number;
  @IsOptional() @IsNumber() ordre?: number;
}

export class CreateBordereauDto {
  @IsEnum(BordereauType) type: BordereauType;
  @IsOptional() @IsString() affaireId?: string;
  @IsOptional() @IsString() situationId?: string;
  @IsOptional() @IsString() cedanteId?: string;
  @IsOptional() @IsString() reassureurCode?: string;
  @IsOptional() @IsDateString() datePeriodeDebut?: string;
  @IsOptional() @IsDateString() datePeriodeFin?: string;
  @IsOptional() @IsString() currency?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BordereauLineDto)
  lines?: BordereauLineDto[];
}