import { IsString, IsOptional, IsNumber, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Shared across Assure / Cedante / Reassureur / CoCourtier — Section 5.7 (doc consolidé).
// NOTE: "Prénom/Nom séparé ?" is still an OPEN QUESTION (5.6.2) — `nom` is kept as the
// safe catch-all (can hold a full name) until the client confirms the exact split.
// Real Excel data (Section 5.5.2 / 12.8) is unparsed: multiple contacts per cell,
// emails/phones mixed — this DTO defines the TARGET shape post-cleanup, not the raw
// import shape.
export class CreateContactDto {
  @ApiProperty() @IsString() nom: string;
  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsString() poste?: string;

  // FIX: was a single `telephone` field — Section 5.7 specifies BOTH for Cédante
  // ("Téléphone fixe, Mobile") and Réassureur ("Téléphone, Mobile"). Assumes the
  // schema's Contact model was updated to telephoneFixe/telephoneMobile — see intro.
  @ApiPropertyOptional({ description: 'Téléphone fixe' })
  @IsOptional() @IsString() telephoneFixe?: string;

  @ApiPropertyOptional({ description: 'Téléphone mobile' })
  @IsOptional() @IsString() telephoneMobile?: string;

  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateAssureDto {
  @ApiProperty() @IsString() raisonSociale: string;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsNumber() capital?: number;
  @IsOptional() @IsString() deviseParDefaut?: string;
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    // Allow string, number, boolean values — reject nested objects/arrays
    // (the real attack surface). Drop oversized keys/values silently.
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const safe: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof k !== 'string' || k.trim().length === 0 || k.length > 100) continue;
      if (v !== null && v !== undefined && typeof v !== 'object') {
        const strVal = String(v);
        if (strVal.length <= 500) safe[k.trim()] = v as string | number | boolean;
      }
    }
    return safe;
  })
  freeFields?: Record<string, string | number | boolean>;
  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}