import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateReassureurDto } from './create-reassureur.dto';
export class UpdateReassureurDto extends PartialType(OmitType(CreateReassureurDto, ['compteComptable'] as const)) {}