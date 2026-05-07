import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');

    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 500) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() is not allowed in production');
    }
    const tableNames = [
      'AuditLog', 'WorkflowTask', 'BudgetTarget',
      'IntegrationExport', 'JournalLine', 'JournalEntry',
      'FiscalPeriod', 'AuxiliaryAccount', 'PlanComptable',
      'BordereauLine', 'Bordereau', 'FxGainLoss',
      'LettrageItem', 'Lettrage', 'BankMovement',
      'OrdrePaiement', 'SituationLine', 'Situation',
      'Settlement', 'Decaissement', 'Encaissement',
      'CashCall', 'SinistreAudit', 'SinistreParticipation',
      'SinistreEvent', 'Sinistre', 'PmdInstalment',
      'TreatyAccountRubrique', 'TraiteAffaire',
      'GuaranteeLine', 'FacultativeAffaire',
      'AffaireReassureur', 'Affaire',
      'DocumentChecklistItem', 'DocumentChecklist',
      'DocumentAccessLog', 'DocumentShare', 'DocumentVersion',
      'DocumentLink', 'Document', 'BankAccount',
      'Contact', 'CoCourtier', 'Reassureur',
      'Cedante', 'Assure', 'Sequence',
      'RefreshToken', 'User', 'ExchangeRate',
      'Currency', 'PrinterConfig', 'PasswordPolicy',
      'CompanyFreeField', 'CompanyContact', 'CompanyBankAccount',
      'CompanyProfile',
    ];
    for (const name of tableNames) {
      await (this as any)[name[0].toLowerCase() + name.slice(1)].deleteMany();
    }
  }
}