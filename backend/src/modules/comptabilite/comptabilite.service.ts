import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { PlanComptable, AccountClass } from './plan-comptable.entity';
import { LedgerEntry } from './ledger.entity';
import { FiscalPeriod, PeriodStatus } from './fiscal-period.entity';
import { AccountingEntry, JournalCode, AccountingEntryStatus } from '../finances/accounting-entry.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ClosePeriodDto } from './dto/close-period.dto';

@Injectable()
export class ComptabiliteService {
  constructor(
    @InjectRepository(PlanComptable) private accountRepo: Repository<PlanComptable>,
    @InjectRepository(LedgerEntry) private ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(FiscalPeriod) private periodRepo: Repository<FiscalPeriod>,
    @InjectRepository(AccountingEntry) private entryRepo: Repository<AccountingEntry>,
  ) {}

  async createAccount(dto: CreateAccountDto): Promise<PlanComptable> {
    const exists = await this.accountRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new BadRequestException(`Account ${dto.code} already exists`);

    const account = this.accountRepo.create(dto);
    return this.accountRepo.save(account);
  }

  async findAllAccounts(filters?: { classe?: AccountClass; isActive?: boolean }): Promise<PlanComptable[]> {
    const where: any = {};
    if (filters?.classe) where.classe = filters.classe;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.accountRepo.find({ where, order: { code: 'ASC' } });
  }

  async findOneAccount(id: string): Promise<PlanComptable> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<PlanComptable> {
    const account = await this.findOneAccount(id);
    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async deleteAccount(id: string): Promise<void> {
    const account = await this.findOneAccount(id);
    account.isActive = false;
    await this.accountRepo.save(account);
  }

  async getLedger(accountCode: string, startDate: string, endDate: string): Promise<LedgerEntry[]> {
    return this.ledgerRepo.find({
      where: {
        accountCode,
        dateOperation: Between(new Date(startDate), new Date(endDate)),
      },
      order: { dateOperation: 'ASC' },
    });
  }

  async getTrialBalance(exercice: number, mois?: number): Promise<any> {
    const where: any = {};
    if (mois) {
      where.periode = `${exercice}-${String(mois).padStart(2, '0')}`;
    } else {
      where.periode = Between(`${exercice}-01`, `${exercice}-12`);
    }

    const ledgers = await this.ledgerRepo.find({ where });

    const balance = {};
    ledgers.forEach(l => {
      if (!balance[l.accountCode]) {
        balance[l.accountCode] = {
          code: l.accountCode,
          label: l.accountLabel,
          debit: 0,
          credit: 0,
          solde: 0,
        };
      }
      balance[l.accountCode].debit += Number(l.debit);
      balance[l.accountCode].credit += Number(l.credit);
      balance[l.accountCode].solde = balance[l.accountCode].debit - balance[l.accountCode].credit;
    });

    return {
      exercice,
      mois,
      accounts: Object.values(balance),
      totalDebit: Object.values(balance).reduce((sum: number, a: any) => sum + a.debit, 0),
      totalCredit: Object.values(balance).reduce((sum: number, a: any) => sum + a.credit, 0),
    };
  }

  async getBalanceSheet(exercice: number): Promise<any> {
    const balance = await this.getTrialBalance(exercice);
    
    const actif = balance.accounts.filter((a: any) => ['1', '2', '3', '4', '5'].includes(a.code[0]) && a.solde > 0);
    const passif = balance.accounts.filter((a: any) => ['1', '2', '3', '4', '5'].includes(a.code[0]) && a.solde < 0);
    const charges = balance.accounts.filter((a: any) => a.code[0] === '6');
    const produits = balance.accounts.filter((a: any) => a.code[0] === '7');

    const totalCharges = charges.reduce((sum: number, a: any) => sum + a.debit, 0);
    const totalProduits = produits.reduce((sum: number, a: any) => sum + a.credit, 0);
    const resultat = totalProduits - totalCharges;

    return {
      exercice,
      actif: {
        accounts: actif,
        total: actif.reduce((sum: number, a: any) => sum + a.solde, 0),
      },
      passif: {
        accounts: passif,
        total: Math.abs(passif.reduce((sum: number, a: any) => sum + a.solde, 0)),
      },
      resultat,
    };
  }

  async getProfitLoss(exercice: number): Promise<any> {
    const balance = await this.getTrialBalance(exercice);
    
    const charges = balance.accounts.filter((a: any) => a.code[0] === '6');
    const produits = balance.accounts.filter((a: any) => a.code[0] === '7');

    const totalCharges = charges.reduce((sum: number, a: any) => sum + a.debit, 0);
    const totalProduits = produits.reduce((sum: number, a: any) => sum + a.credit, 0);

    return {
      exercice,
      charges: {
        accounts: charges,
        total: totalCharges,
      },
      produits: {
        accounts: produits,
        total: totalProduits,
      },
      resultat: totalProduits - totalCharges,
    };
  }

  async getCurrentPeriod(): Promise<FiscalPeriod> {
    const now = new Date();
    const exercice = now.getFullYear();
    const mois = now.getMonth() + 1;

    let period = await this.periodRepo.findOne({ where: { exercice, mois } });
    
    if (!period) {
      period = this.periodRepo.create({
        exercice,
        mois,
        code: `${exercice}-${String(mois).padStart(2, '0')}`,
        dateDebut: new Date(exercice, mois - 1, 1),
        dateFin: new Date(exercice, mois, 0),
        statut: PeriodStatus.OPEN,
      });
      await this.periodRepo.save(period);
    }

    return period;
  }

  async closePeriod(dto: ClosePeriodDto, userId: string): Promise<FiscalPeriod> {
    const period = await this.periodRepo.findOne({ where: { exercice: dto.exercice, mois: dto.mois } });
    if (!period) throw new NotFoundException('Period not found');
    if (period.statut !== PeriodStatus.OPEN) throw new BadRequestException('Period already closed');

    const unvalidatedEntries = await this.entryRepo.count({
      where: {
        dateEcriture: Between(period.dateDebut, period.dateFin),
        statut: In([AccountingEntryStatus.BROUILLON, AccountingEntryStatus.SAISIE]),
      },
    });

    if (unvalidatedEntries > 0) {
      throw new BadRequestException(`Cannot close period: ${unvalidatedEntries} unvalidated entries`);
    }

    period.statut = PeriodStatus.CLOSED;
    period.closedById = userId;
    period.dateCloture = new Date();

    return this.periodRepo.save(period);
  }

  async reopenPeriod(dto: ClosePeriodDto): Promise<FiscalPeriod> {
    const period = await this.periodRepo.findOne({ where: { exercice: dto.exercice, mois: dto.mois } });
    if (!period) throw new NotFoundException('Period not found');
    if (period.statut === PeriodStatus.LOCKED) throw new BadRequestException('Period is locked');

    period.statut = PeriodStatus.OPEN;
    period.closedById = null;
    period.dateCloture = null;

    return this.periodRepo.save(period);
  }

  async updateLedgerFromEntry(entry: AccountingEntry): Promise<void> {
    const periode = `${entry.dateEcriture.getFullYear()}-${String(entry.dateEcriture.getMonth() + 1).padStart(2, '0')}`;

    const debitLedger = this.ledgerRepo.create({
      accountCode: entry.compteDebit,
      accountLabel: entry.libelleCompteDebit || entry.compteDebit,
      dateOperation: entry.dateEcriture,
      periode,
      journalCode: entry.journalCode,
      pieceReference: entry.reference,
      libelle: entry.libelle,
      debit: Number(entry.montantDebit),
      credit: 0,
      solde: Number(entry.montantDebit),
      accountingEntryId: entry.id,
    });

    const creditLedger = this.ledgerRepo.create({
      accountCode: entry.compteCredit,
      accountLabel: entry.libelleCompteCredit || entry.compteCredit,
      dateOperation: entry.dateEcriture,
      periode,
      journalCode: entry.journalCode,
      pieceReference: entry.reference,
      libelle: entry.libelle,
      debit: 0,
      credit: Number(entry.montantCredit),
      solde: -Number(entry.montantCredit),
      accountingEntryId: entry.id,
    });

    await this.ledgerRepo.save([debitLedger, creditLedger]);
  }

}
