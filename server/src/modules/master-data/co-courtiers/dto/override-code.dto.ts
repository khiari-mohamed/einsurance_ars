import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OverrideCoCourtierCodeDto {
  @ApiProperty({ description: 'Nouveau code (format CCO-XXXX)', example: 'CCO-0099' })
  @IsString()
  @Matches(/^CCO-[0-9]{4}$/, { message: 'Le code doit être au format CCO-XXXX' })
  code: string;
}