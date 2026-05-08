import { PartialType } from '@nestjs/swagger';
import { CreateAssureDto } from './create-assure.dto';
export class UpdateAssureDto extends PartialType(CreateAssureDto) {}