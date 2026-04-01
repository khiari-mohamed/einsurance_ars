import { IsOptional, IsString, IsInt, IsDateString, IsEmail } from 'class-validator';

export class ShareDocumentDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  maxDownloads?: number;

  @IsDateString()
  expiresAt: string;
}
