import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfService } from './services/pdf.service';
import { EmailService } from './services/email.service';
import { StorageService } from './services/storage.service';
import { BCTExchangeRateService } from './bct-exchange-rate.service';
import { ImportExportService } from './import-export.service';
import { NotificationWebSocketService } from './notification-websocket.service';
import { ExchangeRate } from '../finances/exchange-rate.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { Sinistre } from '../sinistres/sinistres.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ExchangeRate, Affaire, Cedante, Reassureur, Sinistre]),
  ],
  providers: [
    PdfService,
    EmailService,
    StorageService,
    BCTExchangeRateService,
    ImportExportService,
    NotificationWebSocketService,
  ],
  exports: [
    PdfService,
    EmailService,
    StorageService,
    BCTExchangeRateService,
    ImportExportService,
    NotificationWebSocketService,
  ],
})
export class SharedModule {}
