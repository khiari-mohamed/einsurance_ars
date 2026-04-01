import { PartialType } from '@nestjs/mapped-types';
import { CreateCedanteDto } from './create-cedante.dto';

export class UpdateCedanteDto extends PartialType(CreateCedanteDto) {}
