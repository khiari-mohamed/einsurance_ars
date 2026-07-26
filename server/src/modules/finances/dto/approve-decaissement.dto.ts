import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveDecaissementDto {
  @ApiPropertyOptional({ description: "Niveau d'approbation (réservé pour un futur workflow multi-niveaux)" })
  @IsOptional() @IsInt() @Min(1)
  niveau?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  note?: string;
}