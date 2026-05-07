import { Global, Module } from '@nestjs/common';
import { SequenceService } from './services/sequence.service';
import { AmountToWordsService } from './services/amount-to-words.service';
import { EmailService } from './services/email.service';
import { StorageService } from './services/storage.service';
import { NotificationService } from './services/notification.service';
import { NotificationWebsocketService } from './services/notification-websocket.service';
import { PdfService } from './services/pdf.service';

@Global()
@Module({
  providers: [
    SequenceService,
    AmountToWordsService,
    EmailService,
    StorageService,
    NotificationService,
    NotificationWebsocketService,
    PdfService,
  ],
  exports: [
    SequenceService,
    AmountToWordsService,
    EmailService,
    StorageService,
    NotificationService,
    PdfService,
  ],
})
export class SharedModule {}