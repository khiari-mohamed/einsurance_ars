import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OverrideAssureCodeDto {
  @ApiProperty({ description: 'Nouveau code (format CLI-XXXX)', example: 'CLI-0099' })
  @IsString()
  @Matches(/^CLI-[0-9]{4}$/, { message: 'Le code doit être au format CLI-XXXX' })
  code: string;
}