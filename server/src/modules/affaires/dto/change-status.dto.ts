import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AffaireStatut } from '@prisma/client';

export class ChangeAffaireStatusDto {
  @ApiProperty({ enum: AffaireStatut })
  @IsEnum(AffaireStatut)
  statut: AffaireStatut;
}