import { Module } from '@nestjs/common';
import { TreatyParametersController } from './treaty-parameters.controller';
import { TreatyParametersService } from './treaty-parameters.service';

@Module({
  controllers: [TreatyParametersController],
  providers: [TreatyParametersService],
  exports: [TreatyParametersService],
})
export class TreatyParametersModule {}