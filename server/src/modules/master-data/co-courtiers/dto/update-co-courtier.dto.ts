import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCoCourtierDto } from './create-co-courtier.dto';

// compteComptable is locked after creation — excluded from updates (same pattern as Cedante/Reassureur).
export class UpdateCoCourtierDto extends PartialType(OmitType(CreateCoCourtierDto, ['compteComptable'] as const)) {}