import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequenceService } from './services/sequence.service';
import { AmountToWordsService } from './services/amount-to-words.service';
import { EmailService } from './services/email.service';
import { StorageService } from './services/storage.service';
import { NotificationService } from './services/notification.service';
import { NotificationWebsocketService } from './services/notification-websocket.service';
import { PdfService } from './services/pdf.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('app.jwtSecret'),
        signOptions: { expiresIn: config.get('app.jwtExpiresIn') },
      }),
    }),
  ],
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