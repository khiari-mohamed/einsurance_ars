import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentEntityType } from '@prisma/client';

// Drives which FK column gets populated on DocumentLink.
// Matches DocumentEntityType exactly so there's no translation layer.
export class UploadFileDto {
  @IsEnum(DocumentEntityType)
  entityType: DocumentEntityType;

  @IsUUID()
  entityId: string;

  // Free-form business label, e.g. 'SLIP_COTATION' | 'CONVENTION' | 'SWIFT' | 'POLICE'
  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  // Optional: if provided and a Document already exists with this id,
  // the upload is treated as a NEW VERSION instead of a new Document.
  @IsOptional()
  @IsUUID()
  replaceDocumentId?: string;
}