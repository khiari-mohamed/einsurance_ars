import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { ComptabiliteController } from './comptabilite.controller';
import { ComptabiliteService } from './comptabilite.service';
import { AccountingEngineService } from './accounting-engine.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { PlanComptable } from './plan-comptable.entity';
import { LedgerEntry } from './ledger.entity';
import { FiscalPeriod } from './fiscal-period.entity';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { AuxiliaryAccount } from './auxiliary-account.entity';
import { AccountingEntry } from '../finances/accounting-entry.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { Encaissement } from '../finances/encaissement.entity';
import { Decaissement } from '../finances/decaissement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanComptable,
      LedgerEntry,
      FiscalPeriod,
      JournalEntry,
      JournalLine,
      AuxiliaryAccount,
      AccountingEntry,
      Bordereau,
      Cedante,
      Reassureur,
      Encaissement,
      Decaissement,
    ]),
  ],
  providers: [
    AccountingService,
    ComptabiliteService,
    AccountingEngineService,
    AuxiliaryAccountService,
  ],
  controllers: [ComptabiliteController],
  exports: [
    AccountingService,
    ComptabiliteService,
    AccountingEngineService,
    AuxiliaryAccountService,
  ],
})
export class ComptabiliteModule {}
