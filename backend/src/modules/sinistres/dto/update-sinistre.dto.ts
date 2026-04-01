import { PartialType } from '@nestjs/mapped-types';
import { CreateSinistreDto } from './create-sinistre.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { SinistreStatus } from '../sinistres.entity';

export class UpdateSinistreDto extends PartialType(CreateSinistreDto) {
  @IsEnum(SinistreStatus)
  @IsOptional()
  statut?: SinistreStatus;
}
