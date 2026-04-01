import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { LettrageService } from './lettrage.service';
import { CommissionService } from './commission.service';
import { SettlementService } from './settlement.service';
import { AccountingService } from './accounting.service';
import { AMLService } from './aml.service';
import { TaxService } from './tax.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { ExchangeRateService } from './exchange-rate.service';
import { CronService } from './cron.service';
import { OrdrePaiementService } from './ordre-paiement.service';
import { PDFGeneratorService } from './pdf-generator.service';
import { NotificationService } from './notification.service';
import { FourStepPaymentService } from './four-step-payment.service';
import { Encaissement } from './encaissement.entity';
import { Decaissement } from './decaissement.entity';
import { BankMovement } from './bank-movement.entity';
import { Lettrage } from './lettrage.entity';
import { Settlement } from './settlement.entity';
import { Commission } from './commission.entity';
import { OrdrePaiement } from './ordre-paiement.entity';
import { AccountingEntry } from './accounting-entry.entity';
import { ExchangeRate } from './exchange-rate.entity';
import { AuditLog } from './audit-log.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { User } from '../users/users.entity';

@Module({
  imports: [
    forwardRef(() => ComptabiliteModule),
    TypeOrmModule.forFeature([
      Encaissement,
      Decaissement,
      BankMovement,
      Lettrage,
      Settlement,
      Commission,
      OrdrePaiement,
      AccountingEntry,
      ExchangeRate,
      AuditLog,
      Bordereau,
      Affaire,
      Cedante,
      User,
    ]),
  ],
  controllers: [FinancesController],
  providers: [
    FinancesService,
    LettrageService,
    CommissionService,
    SettlementService,
    AccountingService,
    AMLService,
    TaxService,
    BankReconciliationService,
    ExchangeRateService,
    CronService,
    OrdrePaiementService,
    PDFGeneratorService,
    NotificationService,
    FourStepPaymentService,
  ],
  exports: [
    FinancesService,
    LettrageService,
    CommissionService,
    SettlementService,
    AccountingService,
    OrdrePaiementService,
    PDFGeneratorService,
    NotificationService,
    FourStepPaymentService,
  ],
})
export class FinancesModule {}
