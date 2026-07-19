import { Module } from '@nestjs/common';
import { ConventionsController } from './conventions.controller';
import { ConventionsService } from './conventions.service';
import { GedModule } from '../../ged/ged.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, GedModule],
  controllers: [ConventionsController],
  providers: [ConventionsService],
  exports: [ConventionsService],
})
export class ConventionsModule {}