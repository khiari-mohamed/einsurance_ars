import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { BordereauDocumentType } from '../bordereau-document.entity';

export class AddDocumentDto {
  @IsEnum(BordereauDocumentType)
  type: BordereauDocumentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
