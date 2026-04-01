import { IsString, IsUUID, IsDate, IsNumber, IsOptional, IsBoolean, IsEnum, Min, ValidateNested, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SinistreStatus } from '../sinistres.entity';

export class CreateParticipationDto {
  @IsUUID()
  reassureurId: string;

  @IsNumber()
  @Min(0)
  partPourcentage: number;

  @IsNumber()
  @Min(0)
  montantPart: number;
}

export class CreateSinistreDto {
  @IsString()
  referenceCedante: string;

  @IsUUID()
  affaireId: string;

  @IsUUID()
  cedanteId: string;

  @IsDate()
  @Type(() => Date)
  dateSurvenance: Date;

  @IsDate()
  @Type(() => Date)
  dateDeclarationCedante: Date;

  @IsNumber()
  @Min(0)
  montantTotal: number;

  @IsNumber()
  @Min(0)
  montantCedantePart: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ? value.replace(/<[^>]*>/g, '').trim() : value)
  description?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ? value.replace(/<[^>]*>/g, '').trim() : value)
  cause?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ? value.replace(/<[^>]*>/g, '').trim() : value)
  lieu?: string;

  @IsBoolean()
  @IsOptional()
  cedantePaymentVerified?: boolean;

  @IsBoolean()
  @IsOptional()
  expertiseRequise?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParticipationDto)
  participations: CreateParticipationDto[];
}
