import { IsOptional, IsString, IsEnum } from 'class-validator';
import { DocumentStatut } from '@prisma/client';
export class SearchDocumentDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() affaireId?: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsEnum(DocumentStatut) statut?: DocumentStatut;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}