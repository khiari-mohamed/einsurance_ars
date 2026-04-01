import { IsEnum, IsString, IsOptional, IsArray, IsDateString, IsUUID } from 'class-validator';
import { EntityType, DocumentType, ConfidentialityLevel } from '../document.entity';

export class UploadDocumentDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsUUID()
  entityId: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
