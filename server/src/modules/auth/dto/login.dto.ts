import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@ars-tunisie.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}