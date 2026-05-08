import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateFacultativeDto } from './create-facultative.dto';

// affaireId and reassuranceType are immutable once set
export class UpdateFacultativeDto extends PartialType(
  OmitType(CreateFacultativeDto, ['affaireId', 'reassuranceType'] as const),
) {}