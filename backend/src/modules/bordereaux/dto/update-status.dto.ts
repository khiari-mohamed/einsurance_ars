import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BordereauStatus } from '../bordereaux.entity';

export class UpdateStatusDto {
  @IsEnum(BordereauStatus)
  status: BordereauStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}