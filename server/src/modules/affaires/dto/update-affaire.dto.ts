import { PartialType } from '@nestjs/swagger';
import { CreateAffaireDto } from './create-affaire.dto';
export class UpdateAffaireDto extends PartialType(CreateAffaireDto) {}