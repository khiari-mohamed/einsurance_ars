import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OverrideCedanteCodeDto {
  @ApiProperty({ description: 'Nouveau code (format CAS-XXXX)', example: 'CAS-0099' })
  @IsString()
  @Matches(/^CAS-[0-9]{4}$/, { message: 'Le code doit être au format CAS-XXXX' })
  code: string;
}