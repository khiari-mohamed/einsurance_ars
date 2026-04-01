import { PartialType } from '@nestjs/mapped-types';
import { CreateEncaissementDto } from './create-encaissement.dto';

export class UpdateEncaissementDto extends PartialType(CreateEncaissementDto) {}
