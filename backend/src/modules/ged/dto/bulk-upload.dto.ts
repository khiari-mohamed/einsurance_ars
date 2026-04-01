import { IsEnum, IsUUID, IsOptional, IsArray } from 'class-validator';
import { EntityType, DocumentType } from '../document.entity';

export class BulkUploadDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsUUID()
  entityId: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
