import { IsString, IsUUID, IsDate, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpertiseDto {
  @IsUUID()
  sinistreId: string;

  @IsString()
  expertNom: string;

  @IsString()
  @IsOptional()
  expertSociete?: string;

  @IsDate()
  @Type(() => Date)
  dateDesignation: Date;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coutExpertise?: number;
}
