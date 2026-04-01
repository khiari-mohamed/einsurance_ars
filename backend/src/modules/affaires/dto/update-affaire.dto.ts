import { PartialType } from '@nestjs/mapped-types';
import { CreateAffaireDto } from './create-affaire.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AffaireStatus } from '../affaires.entity';

export class UpdateAffaireDto extends PartialType(CreateAffaireDto) {
  @IsEnum(AffaireStatus)
  @IsOptional()
  status?: AffaireStatus;
}
