import { PartialType } from '@nestjs/mapped-types';
import { CreateReassureurDto } from './create-reassureur.dto';

export class UpdateReassureurDto extends PartialType(CreateReassureurDto) {}
