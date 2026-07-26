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
import { ExchangeRateResolverService } from './exchange-rate-resolver.service';

@Module({
  controllers: [FinancesController],
  providers: [
    FinancesService, SettlementService, SituationService,
    LettrageService, OrdrePaiementService, FxGainLossService,
    FourStepPaymentService, BankReconciliationService, AmlService,
    ExchangeRateResolverService,
  ],
  // FIX (Finances pass): previously only exported 3 of 9 providers. The
  // next module in the roadmap (Comptabilité's GEC) will need to pull
  // technical events from Encaissement/Decaissement/Bordereau via
  // Situation/Lettrage/OrdrePaiement — same reasoning as Affaires exporting
  // everything. Exporting the full provider set preemptively.
  exports: [
    FinancesService, SettlementService, SituationService,
    LettrageService, OrdrePaiementService, FxGainLossService,
    FourStepPaymentService, BankReconciliationService, AmlService,
    ExchangeRateResolverService,
  ],
})
export class FinancesModule {}