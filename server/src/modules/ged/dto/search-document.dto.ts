import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatut, DocumentEntityType } from '@prisma/client';

export class SearchDocumentDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() affaireId?: string;

  // NEW: generic entity filter (was previously only possible via affaireId,
  // which meant the /ged/documents list could never be filtered to e.g. a
  // single cédante or réassureur's documents).
  @IsOptional() @IsEnum(DocumentEntityType) entityType?: DocumentEntityType;
  @IsOptional() @IsString() entityId?: string;

  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsEnum(DocumentStatut) statut?: DocumentStatut;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;

  // FIX: page/limit were previously read manually in the controller via
  // separate @Query('page')/@Query('limit') bindings, sitting outside the
  // validated DTO entirely (no type coercion, no bounds checking). Now part
  // of the DTO so they're validated/coerced like everything else.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}