import { Module } from '@nestjs/common';
import { AssuresController } from './assures.controller';
import { AssuresService } from './assures.service';

@Module({
  controllers: [AssuresController],
  providers: [AssuresService],
  exports: [AssuresService],
})
export class AssuresModule {}