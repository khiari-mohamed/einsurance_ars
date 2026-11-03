import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { NegotiationStatus, NegotiationSubject } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class CreateNegotiationDto {
  @IsOptional() @IsInt() @Min(1) round?: number;
  @IsDateString() date: string;
  @IsString() @IsNotEmpty() counterparty: string;
  @IsEnum(NegotiationSubject) subject: NegotiationSubject;
  @IsOptional() @IsString() currentValue?: string;
  @IsOptional() @IsString() proposedValue?: string;
  @IsOptional() @IsEnum(NegotiationStatus) status?: NegotiationStatus;
  @IsOptional() @Transform(emptyToNull) @IsDateString() deadline?: string | null;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateNegotiationDto extends PartialType(CreateNegotiationDto) {}
