import { PartialType } from '@nestjs/mapped-types';
import { CreateOrdrePaiementDto } from './create-ordre-paiement.dto';

export class UpdateOrdrePaiementDto extends PartialType(CreateOrdrePaiementDto) {}
