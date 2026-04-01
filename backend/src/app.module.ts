import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AssuresModule } from './modules/assures/assures.module';
import { CedantesModule } from './modules/cedantes/cedantes.module';
import { ReassureursModule } from './modules/reassureurs/reassureurs.module';
import { CoCourtiersModule } from './modules/co-courtiers/co-courtiers.module';
import { AffairesModule } from './modules/affaires/affaires.module';
import { TraitesModule } from './modules/traites/traites.module';
import { SinistresModule } from './modules/sinistres/sinistres.module';
import { FinancesModule } from './modules/finances/finances.module';
import { ComptabiliteModule } from './modules/comptabilite/comptabilite.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { GedModule } from './modules/ged/ged.module';
import { SharedModule } from './modules/shared/shared.module';
import { BordereauxModule } from './modules/bordereaux/bordereaux.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { SystemModule } from './modules/system/system.module';
import { PaymentOrdersModule } from './modules/payment-orders/payment-orders.module';
import { SlipsModule } from './modules/slips/slips.module';
import { ProspectionModule } from './modules/prospection/prospection.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
    }),
    SharedModule,
    AuthModule,
    UsersModule,
    AssuresModule,
    CedantesModule,
    ReassureursModule,
    CoCourtiersModule,
    AffairesModule,
    TraitesModule,
    SinistresModule,
    BordereauxModule,
    CommissionsModule,
    SettlementsModule,
    PaymentOrdersModule,
    SlipsModule,
    FinancesModule,
    ComptabiliteModule,
    ReportingModule,
    WorkflowModule,
    SystemModule,
    GedModule,
    ProspectionModule,
  ],
})
export class AppModule {}
