import { PartialType } from '@nestjs/swagger';
import { CreateAssureDto } from './create-assure.dto';

// Assuré has no compte comptable (CDC: ARS doesn't post accounting entries directly
// against the assuré) — nothing needs omitting/locking, unlike the other 3 fiches.
export class UpdateAssureDto extends PartialType(CreateAssureDto) {}