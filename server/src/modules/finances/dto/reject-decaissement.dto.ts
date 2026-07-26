import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectDecaissementDto {
  @ApiProperty({ description: 'Motif du rejet' })
  @IsString()
  motif: string;
}