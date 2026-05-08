import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
export class AdjustSapDto {
  @IsNumber() @Min(0) sap: number;
  @IsOptional() @IsString() note?: string;
}