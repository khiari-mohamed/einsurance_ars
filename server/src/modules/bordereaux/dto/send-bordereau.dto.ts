import { IsArray, ArrayNotEmpty, IsEmail } from 'class-validator';

export class SendBordereauDto {
  @IsArray() @ArrayNotEmpty() @IsEmail({}, { each: true })
  recipients: string[];
}