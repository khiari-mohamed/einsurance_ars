import { PartialType } from '@nestjs/mapped-types';
import { CreateDecaissementDto } from './create-decaissement.dto';

export class UpdateDecaissementDto extends PartialType(CreateDecaissementDto) {}
