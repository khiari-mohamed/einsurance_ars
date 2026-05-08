import { IsString, IsArray, IsOptional } from 'class-validator';
export class ValidateEntryDto {
  @IsArray() @IsString({ each: true }) entryIds: string[];
  @IsOptional() @IsString() note?: string;
}