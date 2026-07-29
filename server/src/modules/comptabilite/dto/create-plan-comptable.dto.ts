import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreatePlanComptableDto {
  @Matches(/^[0-9]{5,8}$/, { message: 'Le compte doit contenir entre 5 et 8 chiffres' })
  compte: string;

  @IsString() libelle: string;

  // Kept as a free string, matching the schema — PlanComptable.type is not a Prisma enum.
  @Matches(/^(DEBIT_NORMAL|CREDIT_NORMAL)$/)
  type: string;

  @Matches(/^[1-7]$/, { message: 'La classe doit être un chiffre de 1 à 7' })
  classe: string;

  @IsOptional() @IsBoolean() isAuxiliary?: boolean;
}