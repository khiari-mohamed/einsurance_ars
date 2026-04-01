import { IsEnum, IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { EntityType, DocumentType, DocumentStatus, ConfidentialityLevel } from '../document.entity';

export class SearchDocumentDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsDateString()
  uploadedAfter?: string;

  @IsOptional()
  @IsDateString()
  uploadedBefore?: string;

  @IsOptional()
  @IsUUID()
  uploadedById?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}
