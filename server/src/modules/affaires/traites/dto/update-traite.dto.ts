import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTraiteDto } from './create-traite.dto';

// affaireId and reassuranceType are immutable once set
export class UpdateTraiteDto extends PartialType(
  OmitType(CreateTraiteDto, ['affaireId', 'reassuranceType'] as const),
) {}