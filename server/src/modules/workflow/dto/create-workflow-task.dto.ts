import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowTaskType } from '@prisma/client';

export class CreateWorkflowTaskDto {
  @ApiProperty({ enum: WorkflowTaskType })
  @IsEnum(WorkflowTaskType)
  type: WorkflowTaskType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Affaire liée (optionnel)' })
  @IsOptional() @IsString()
  affaireId?: string;

  @ApiPropertyOptional({ description: 'Utilisateur assigné dès la création' })
  @IsOptional() @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  dueDate?: string;
}