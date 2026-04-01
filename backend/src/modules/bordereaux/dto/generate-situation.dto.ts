import { IsEnum, IsUUID, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateSituationDto {
  @IsEnum(['cedante', 'reassureur'])
  entityType: string;

  @IsUUID()
  entityId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsBoolean()
  includeOpeningBalance?: boolean;
}
