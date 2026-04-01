import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assure } from './assures.entity';
import { AssureContact } from './contact.entity';
import { AssuresService } from './assures.service';
import { AssuresController } from './assures.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Assure, AssureContact])],
  providers: [AssuresService],
  controllers: [AssuresController],
  exports: [AssuresService],
})
export class AssuresModule {}
