import { IsEnum, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdjustmentType } from '../sinistres.entity';

export class AdjustSAPDto {
  @IsUUID()
  sinistreId: string;

  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @IsNumber()
  @Min(0)
  montant: number;

  @IsString()
  @Transform(({ value }) => value ? value.replace(/<[^>]*>/g, '').trim() : value)
  raison: string;
}
