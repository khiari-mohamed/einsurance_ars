import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { SettlementService } from './settlement.service';
import { SituationService } from './situation.service';
import { LettrageService } from './lettrage.service';
import { OrdrePaiementService } from './ordre-paiement.service';
import { FxGainLossService } from './fx-gain-loss.service';
import { FourStepPaymentService } from './four-step-payment.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { AmlService } from './aml.service';

@Module({
  controllers: [FinancesController],
  providers: [
    FinancesService, SettlementService, SituationService,
    LettrageService, OrdrePaiementService, FxGainLossService,
    FourStepPaymentService, BankReconciliationService, AmlService,
  ],
  exports: [FinancesService, FxGainLossService, SettlementService],
})
export class FinancesModule {}