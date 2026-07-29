import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdatePlanComptableDto {
  @IsOptional() @IsString() libelle?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}