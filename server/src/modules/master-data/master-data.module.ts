import { Module } from '@nestjs/common';
import { AssuresModule } from './assures/assures.module';
import { CedantesModule } from './cedantes/cedantes.module';
import { ReassureursModule } from './reassureurs/reassureurs.module';
import { CoCourtierModule } from './co-courtiers/co-courtiers.module';
import { ConventionsModule } from './conventions/conventions.module'; // FIX: was completely missing

@Module({
  imports: [AssuresModule, CedantesModule, ReassureursModule, CoCourtierModule, ConventionsModule],
  exports: [AssuresModule, CedantesModule, ReassureursModule, CoCourtierModule, ConventionsModule],
})
export class MasterDataModule {}