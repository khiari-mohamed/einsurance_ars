import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCoCourtierDto } from './create-co-courtier.dto';
export class UpdateCoCourtierDto extends PartialType(OmitType(CreateCoCourtierDto, ['compteComptable'] as const)) {}