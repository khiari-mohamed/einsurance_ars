import { IsEnum, IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { BordereauType } from '../bordereaux.entity';

export class CreateBordereauLigneDto {
  @IsUUID()
  affaireId: string;

  @IsString()
  description: string;

  @IsNumber()
  montantBrut: number;

  @IsOptional()
  @IsNumber()
  tauxCession?: number;

  @IsNumber()
  montantCede: number;

  @IsOptional()
  @IsNumber()
  commissionMontant?: number;

  @IsNumber()
  netAPayer: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBordereauDto {
  @IsEnum(BordereauType)
  type: BordereauType;

  @IsUUID()
  cedanteId: string;

  @IsOptional()
  @IsUUID()
  reassureurId?: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsDateString()
  dateEmission: string;

  @IsOptional()
  @IsDateString()
  dateLimitePaiement?: string;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBordereauLigneDto)
  lignes?: CreateBordereauLigneDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  affaireIds?: string[];
}
