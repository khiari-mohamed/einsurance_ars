import { PartialType } from '@nestjs/mapped-types';
import { CreateBordereauDto } from './create-bordereau.dto';

// Only usable while statut === BROUILLON (enforced in service, not here).
// `type` is intentionally still editable pre-validation; lines, if present,
// fully replace existing lines (delete + recreate) — see service.update().
export class UpdateBordereauDto extends PartialType(CreateBordereauDto) {}