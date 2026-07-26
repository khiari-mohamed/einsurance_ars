import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReconcileDto {
  @ApiProperty() @IsString() bankMovementId: string;
}

export class ReconcileEncaissementDto extends ReconcileDto {
  @ApiProperty() @IsString() encaissementId: string;
}

export class ReconcileDecaissementDto extends ReconcileDto {
  @ApiProperty() @IsString() decaissementId: string;
}