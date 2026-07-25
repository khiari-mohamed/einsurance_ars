import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

// Bound alongside a multipart `file` field — see BordereauxController.uploadDocument().
export class AttachDocumentDto {
  @IsString() @IsNotEmpty() documentType: string; // free-text, mirrors Document.documentType — see ged.types.ts DocumentType on the frontend for the curated list actually offered in the UI
  @IsOptional() @IsString() description?: string;
}