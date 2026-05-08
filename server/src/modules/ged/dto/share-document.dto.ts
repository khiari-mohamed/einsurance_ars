import { IsString, IsOptional } from 'class-validator';
export class ShareDocumentDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() expiresAt?: string;
}