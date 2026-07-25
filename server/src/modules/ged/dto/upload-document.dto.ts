import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DocumentEntityType } from '@prisma/client';

// Unchanged in shape — already correctly matched by GedService.resolveEntityRef().
// Left as-is; only re-confirming it lines up with the entity resolution logic below.
export class UploadDocumentDto {
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsEnum(DocumentEntityType) entityType?: DocumentEntityType;
  @IsOptional() @IsString() assureId?: string;
  @IsOptional() @IsString() cedanteId?: string;
  @IsOptional() @IsString() reassureurId?: string;
  @IsOptional() @IsString() coCourtId?: string;
  @IsOptional() @IsString() affaireId?: string;
  @IsOptional() @IsString() sinistreId?: string;
  @IsOptional() @IsString() encaissementId?: string;
  @IsOptional() @IsString() decaissementId?: string;
  @IsOptional() @IsString() ordrePaiementId?: string;
  @IsOptional() @IsString() bordereauId?: string;
  @IsOptional() @IsString() comment?: string;
}