import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CalculateLiquidationDto } from './calculate-liquidation.dto';

// NEW: extends the existing (now-validated) simulation input with the
// period it covers, needed to persist a TraiteLiquidation record.
export class PersistLiquidationDto extends CalculateLiquidationDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  periodeDebut: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  periodeFin: string;
}