import { Module } from '@nestjs/common';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { BctSyncService } from './bct-sync.service';

@Module({
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, BctSyncService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}