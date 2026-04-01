import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cedante } from './cedantes.entity';
import { CedanteContact } from './contact.entity';
import { CedantesService } from './cedantes.service';
import { CedantesController } from './cedantes.controller';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cedante, CedanteContact]),
    forwardRef(() => ComptabiliteModule),
  ],
  providers: [CedantesService],
  controllers: [CedantesController],
  exports: [CedantesService],
})
export class CedantesModule {}
