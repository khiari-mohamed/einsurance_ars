import { Module } from '@nestjs/common';
import { AssuresModule } from './assures/assures.module';
import { CedantesModule } from './cedantes/cedantes.module';
import { ReassureursModule } from './reassureurs/reassureurs.module';
import { CoCourtierModule } from './co-courtiers/co-courtiers.module';

@Module({
  imports: [AssuresModule, CedantesModule, ReassureursModule, CoCourtierModule],
  exports: [AssuresModule, CedantesModule, ReassureursModule, CoCourtierModule],
})
export class MasterDataModule {}