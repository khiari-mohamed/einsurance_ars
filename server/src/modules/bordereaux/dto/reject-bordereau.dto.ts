import { IsString, IsNotEmpty } from 'class-validator';

export class RejectBordereauDto {
  @IsString() @IsNotEmpty() reason: string;
}