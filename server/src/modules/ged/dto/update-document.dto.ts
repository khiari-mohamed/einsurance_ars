import { IsOptional, IsString, IsEnum } from 'class-validator';
import { DocumentStatut } from '@prisma/client';

// NEW: this DTO didn't exist at all — PUT /ged/documents/:id was called by
// the frontend (gedApi.updateDocument) against a route that had no backend
// implementation whatsoever.
export class UpdateDocumentDto {
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsEnum(DocumentStatut) statut?: DocumentStatut;
}