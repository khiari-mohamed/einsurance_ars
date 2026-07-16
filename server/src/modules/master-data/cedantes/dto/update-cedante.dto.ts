import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCedanteDto } from './create-cedante.dto';

// compteComptable is locked after creation — excluded from updates
export class UpdateCedanteDto extends PartialType(OmitType(CreateCedanteDto, ['compteComptable'] as const)) {}