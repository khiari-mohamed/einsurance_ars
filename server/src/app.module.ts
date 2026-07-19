import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { configValidationSchema } from './config/config.validation';
import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SystemModule } from './modules/system/system.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { AffairesModule } from './modules/affaires/affaires.module';
import { FacultativeModule } from './modules/affaires/facultative/facultative.module';
import { TraitesModule } from './modules/affaires/traites/traites.module';
import { SinistresModule } from './modules/sinistres/sinistres.module';
import { FinancesModule } from './modules/finances/finances.module';
import { ComptabiliteModule } from './modules/comptabilite/comptabilite.module';
import { BordereauxModule } from './modules/bordereaux/bordereaux.module';
import { GedModule } from './modules/ged/ged.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { UploadsModule } from './modules/upload/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true }),
    PrismaModule,
    SharedModule,
    AuthModule,
    UsersModule,
    SystemModule,
    ExchangeRatesModule,
    MasterDataModule,
    AffairesModule,
    FacultativeModule,
    TraitesModule,
    SinistresModule,
    FinancesModule,
    ComptabiliteModule,
    BordereauxModule,
    GedModule,
    ReportingModule,
    WorkflowModule,
    UploadsModule,
  ],
})
export class AppModule {}