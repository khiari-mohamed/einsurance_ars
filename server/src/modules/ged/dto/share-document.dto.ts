import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class ShareDocumentDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsDateString() expiresAt?: string;

  // These fields are accepted here and mapped into DocumentShare once the
  // migration is applied. They are not yet enforced at access time unless the
  // share service explicitly checks them.
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsInt() @Min(1) maxDownloads?: number;
}