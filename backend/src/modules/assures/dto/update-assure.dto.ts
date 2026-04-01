import { PartialType } from '@nestjs/mapped-types';
import { CreateAssureDto } from './create-assure.dto';

export class UpdateAssureDto extends PartialType(CreateAssureDto) {}
