import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OverrideReassureurCodeDto {
  @ApiProperty({ description: 'Nouveau code (format REA-XXXX)', example: 'REA-0099' })
  @IsString()
  @Matches(/^REA-[0-9]{4}$/, { message: 'Le code doit être au format REA-XXXX' })
  code: string;
}