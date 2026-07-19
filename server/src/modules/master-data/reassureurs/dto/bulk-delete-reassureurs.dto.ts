import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkDeleteReassureursDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}