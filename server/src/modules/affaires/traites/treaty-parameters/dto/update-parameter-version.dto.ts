import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CreateTreatyParameterVersionDto } from './create-parameter-version.dto';

// Every field optional (unspecified ones carry forward from the current
// active version — see service), EXCEPT motifModification, which is
// mandatory here: every supersession must be traceable to a stated reason.
export class UpdateTreatyParameterVersionDto extends PartialType(
  OmitType(CreateTreatyParameterVersionDto, ['motifModification'] as const),
) {
  @ApiProperty({ description: "Motif de la modification — obligatoire pour tracer l'historique" })
  @IsString()
  motifModification: string;
}