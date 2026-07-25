import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentEntityType } from '@prisma/client';

// NEW: the bulk-upload route previously had no backend implementation at
// all (frontend gedApi.bulkUpload() had nowhere to POST to). This DTO
// validates the multipart form fields the same way UploadDocumentDto does
// for the single-file route.
export class BulkUploadDto {
  @IsEnum(DocumentEntityType) entityType: DocumentEntityType;
  @IsNotEmpty() @IsString() entityId: string;
  @IsOptional() @IsString() documentType?: string;
}