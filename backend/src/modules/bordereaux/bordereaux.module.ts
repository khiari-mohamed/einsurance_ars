import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bordereau } from './bordereaux.entity';
import { BordereauLigne } from './bordereau-line.entity';
import { BordereauDocument } from './bordereau-document.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { User } from '../users/users.entity';
import { BordereauxService } from './bordereaux.service';
import { BordereauxController } from './bordereaux.controller';
import { SharedModule } from '../shared/shared.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bordereau,
      BordereauLigne,
      BordereauDocument,
      Affaire,
      Cedante,
      Reassureur,
      User,
    ]),
    SharedModule,
    forwardRef(() => ComptabiliteModule),
  ],
  providers: [BordereauxService],
  controllers: [BordereauxController],
  exports: [BordereauxService],
})
export class BordereauxModule {}