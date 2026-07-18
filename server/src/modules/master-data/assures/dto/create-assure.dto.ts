import { IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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
}

export class CreateAssureDto {
  @ApiProperty() @IsString() raisonSociale: string;
  @IsOptional() @IsString() rne?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsNumber() capital?: number;
  @IsOptional() freeFields?: Record<string, any>;
  @ApiPropertyOptional({ type: [CreateContactDto] })
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}