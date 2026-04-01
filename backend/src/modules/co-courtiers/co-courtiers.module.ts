import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoCourtier } from './co-courtiers.entity';
import { CoCourtiersService } from './co-courtiers.service';
import { CoCourtiersController } from './co-courtiers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CoCourtier])],
  providers: [CoCourtiersService],
  controllers: [CoCourtiersController],
  exports: [CoCourtiersService],
})
export class CoCourtiersModule {}
