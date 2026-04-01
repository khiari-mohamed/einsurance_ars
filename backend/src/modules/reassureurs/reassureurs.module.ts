import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reassureur } from './reassureurs.entity';
import { ReassureursService } from './reassureurs.service';
import { ReassureursController } from './reassureurs.controller';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reassureur]),
    forwardRef(() => ComptabiliteModule),
  ],
  providers: [ReassureursService],
  controllers: [ReassureursController],
  exports: [ReassureursService],
})
export class ReassureursModule {}
