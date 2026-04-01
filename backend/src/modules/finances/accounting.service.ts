import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AccountingEntry, JournalCode, AccountingEntryStatus } from './accounting-entry.entity';
import { Encaissement, EncaissementStatus, SourceType } from './encaissement.entity';
import { Decaissement, DecaissementStatus, BeneficiaireType } from './decaissement.entity';
import { Commission, CommissionType } from './commission.entity';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(AccountingEntry)
    private entryRepo: Repository<AccountingEntry>,
    @InjectRepository(Encaissement)
    private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  // ==================== ENTRY CREATION ====================

  /**
   * Auto-generate accounting entry for validated encaissement
   * Debit: Banque (512) or Compte Client (411)
   * Credit: Client (411) or Cédante (401)
   */
  async createEncaissementEntry(encaissementId: string, userId: string): Promise<AccountingEntry> {
    const encaissement = await this.encaissementRepo.findOne({
      where: { id: encaissementId },
      relations: ['cedante', 'client', 'reassureur'],
    });

    if (!encaissement) {
      throw new NotFoundException(`Encaissement ${encaissementId} not found`);
    }

    const montant = Number(encaissement.montantEquivalentTND);

    // Determine accounts based on source
    let accountDebit = '512100'; // Bank account (default)
    let accountCredit = '411000'; // Client receivables

    if (encaissement.sourceType === SourceType.CEDANTE) {
      accountCredit = '411000'; // Cedante account
    } else if (encaissement.sourceType === SourceType.REASSUREUR) {
      accountCredit = '401000'; // Supplier payables
    }

    const reference = await this.generateEntryReference(JournalCode.BNQ);

    const entry = this.entryRepo.create({
      reference,
      journalCode: JournalCode.BNQ,
      dateEcriture: new Date(encaissement.dateEncaissement),
      dateValeur: new Date(encaissement.dateEncaissement),
      compteDebit: accountDebit,
      compteCredit: accountCredit,
      montantDebit: montant,
      montantCredit: montant,
      devise: encaissement.devise,
      tauxChange: Number(encaissement.tauxChange),
      typeReference: 'ENCAISSEMENT',
      idReference: encaissementId,
      referencePiece: encaissement.numero,
      libelle: `Encaissement ${encaissement.numero}`,
      description: `Payment received from ${encaissement.sourceType}`,
      statut: AccountingEntryStatus.SAISIE,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: 'Encaissement entry created',
      }],
    });

    const saved = await this.entryRepo.save(entry);

    // Link back to encaissement
    encaissement.pieceComptable = saved.reference;
    await this.encaissementRepo.save(encaissement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.ACCOUNTING_ENTRY,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Accounting entry created for encaissement: ${reference}`,
      afterValues: saved,
    });

    return saved;
  }

  /**
   * Auto-generate accounting entry for executed décaissement
   * Debit: Supplier (401) or Reassurer
   * Credit: Banque (512)
   * Also handle commission as separate entry
   */
  async createDecaissementEntry(decaissementId: string, userId: string): Promise<AccountingEntry> {
    const decaissement = await this.decaissementRepo.findOne({
      where: { id: decaissementId },
      relations: ['reassureur', 'cedante'],
    });

    if (!decaissement) {
      throw new NotFoundException(`Décaissement ${decaissementId} not found`);
    }

    const montantNet = Number(decaissement.montantNetReassureur);
    const montantTotal = Number(decaissement.montantTotal);

    // Main entry: Supplier to Bank
    let accountDebit = '401000'; // Supplier account
    if (decaissement.beneficiaireType === BeneficiaireType.CEDANTE) {
      accountDebit = '401000';
    }

    const reference = await this.generateEntryReference(JournalCode.ACH);

    const mainEntry = this.entryRepo.create({
      reference,
      journalCode: JournalCode.ACH,
      dateEcriture: new Date(decaissement.dateDecaissement),
      dateValeur: new Date(decaissement.dateValeur),
      compteDebit: accountDebit,
      compteCredit: '512100', // Bank account
      montantDebit: montantNet,
      montantCredit: montantTotal,
      devise: decaissement.devise,
      tauxChange: Number(decaissement.tauxChange),
      typeReference: 'DECAISSEMENT',
      idReference: decaissementId,
      referencePiece: decaissement.numero,
      libelle: `Décaissement ${decaissement.numero}`,
      description: `Payment to ${decaissement.beneficiaireType}`,
      statut: AccountingEntryStatus.SAISIE,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: 'Décaissement entry created',
      }],
    });

    const savedMain = await this.entryRepo.save(mainEntry);

    // Create separate entry for bank fees if applicable
    if (Number(decaissement.fraisBancaires) > 0) {
      const feeEntry = this.entryRepo.create({
        reference: await this.generateEntryReference(JournalCode.OPE),
        journalCode: JournalCode.OPE,
        dateEcriture: new Date(decaissement.dateDecaissement),
        dateValeur: new Date(decaissement.dateValeur),
        compteDebit: '627500', // Bank fees expense account
        compteCredit: '512100', // Bank
        montantDebit: Number(decaissement.fraisBancaires),
        montantCredit: Number(decaissement.fraisBancaires),
        devise: 'TND',
        typeReference: 'DECAISSEMENT',
        idReference: decaissementId,
        referencePiece: decaissement.numero,
        libelle: `Bank fees for ${decaissement.numero}`,
        statut: AccountingEntryStatus.SAISIE,
        createdById: userId,
      });
      await this.entryRepo.save(feeEntry);
    }

    // Link back to décaissement
    decaissement.pieceComptable = savedMain.reference;
    await this.decaissementRepo.save(decaissement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.ACCOUNTING_ENTRY,
      entityId: savedMain.id,
      userId,
      userEmail: '',
      description: `Accounting entry created for décaissement: ${reference}`,
      afterValues: savedMain,
    });

    return savedMain;
  }

  /**
   * Create accounting entry for commission payment
   * Debit: Commission ARS account (70510000)
   * Credit: Bank or Supplier account
   */
  async createCommissionEntry(commissionId: string, userId: string): Promise<AccountingEntry> {
    const commission = await this.commissionRepo.findOne({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`);
    }

    const montant = Number(commission.montant);
    let accountDebit = '70510000'; // ARS Commission (default)
    let accountCredit = '401000'; // Supplier (if paying to cédante/courtier)

    if (commission.type === CommissionType.CEDANTE) {
      accountDebit = '70600000'; // Cédante commission account
      accountCredit = '401000'; // Payable to cédante
    } else if (commission.type === CommissionType.COURTIER) {
      accountCredit = '401000'; // Payable to courtier
    }

    const reference = await this.generateEntryReference(JournalCode.VTE);

    const entry = this.entryRepo.create({
      reference,
      journalCode: JournalCode.VTE,
      dateEcriture: new Date(),
      dateValeur: new Date(),
      compteDebit: accountDebit,
      compteCredit: accountCredit,
      montantDebit: montant,
      montantCredit: montant,
      devise: 'TND',
      typeReference: 'COMMISSION',
      idReference: commissionId,
      referencePiece: commission.numero,
      libelle: `Commission ${commission.type} - ${commission.numero}`,
      statut: AccountingEntryStatus.SAISIE,
      createdById: userId,
    });

    const saved = await this.entryRepo.save(entry);

    // Link to commission
    commission.pieceComptable = saved.reference;
    commission.compteComptable = accountDebit;
    await this.commissionRepo.save(commission);

    return saved;
  }

  // ==================== JOURNAL ENTRIES ====================

  async findAllEntries(filters?: {
    journalCode?: JournalCode;
    startDate?: string;
    endDate?: string;
    compteDebit?: string;
    statut?: AccountingEntryStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: AccountingEntry[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 100;
    const skip = (page - 1) * limit;

    const query = this.entryRepo.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.createdBy', 'createdBy');

    if (filters?.journalCode) {
      query.andWhere('entry.journalCode = :journalCode', { journalCode: filters.journalCode });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('entry.dateEcriture BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.compteDebit) {
      query.andWhere('entry.compteDebit = :compteDebit', { compteDebit: filters.compteDebit });
    }

    if (filters?.statut) {
      query.andWhere('entry.statut = :statut', { statut: filters.statut });
    }

    const [data, total] = await query
      .orderBy('entry.dateEcriture', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async validateEntry(entryId: string, userId: string): Promise<AccountingEntry> {
    const entry = await this.entryRepo.findOne({ where: { id: entryId } });

    if (!entry) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }

    if (entry.statut !== AccountingEntryStatus.SAISIE) {
      throw new BadRequestException('Only SAISIE entries can be validated');
    }

    entry.statut = AccountingEntryStatus.VALIDEE;
    entry.valideParId = userId;
    entry.dateValidation = new Date();

    entry.historique.push({
      date: new Date(),
      action: 'VALIDATION',
      user: userId,
      details: 'Entry validated',
    });

    return this.entryRepo.save(entry);
  }

  async comptabilizeEntry(entryId: string, userId: string): Promise<AccountingEntry> {
    const entry = await this.entryRepo.findOne({ where: { id: entryId } });

    if (!entry) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }

    if (entry.statut !== AccountingEntryStatus.VALIDEE) {
      throw new BadRequestException('Only VALIDEE entries can be comptabilized');
    }

    entry.statut = AccountingEntryStatus.COMPTABILISEE;

    entry.historique.push({
      date: new Date(),
      action: 'COMPTABILISATION',
      user: userId,
      details: 'Entry comptabilized',
    });

    return this.entryRepo.save(entry);
  }

  // ==================== REPORTING ====================

  /**
   * Generate trial balance
   */
  async getTrialBalance(startDate: string, endDate: string): Promise<any> {
    const entries = await this.entryRepo.find({
      where: {
        dateEcriture: Between(new Date(startDate), new Date(endDate)),
        statut: AccountingEntryStatus.COMPTABILISEE,
      },
    });

    const byAccount = {};

    entries.forEach(e => {
      if (!byAccount[e.compteDebit]) {
        byAccount[e.compteDebit] = { debit: 0, credit: 0 };
      }
      if (!byAccount[e.compteCredit]) {
        byAccount[e.compteCredit] = { debit: 0, credit: 0 };
      }

      byAccount[e.compteDebit].debit += Number(e.montantDebit);
      byAccount[e.compteCredit].credit += Number(e.montantCredit);
    });

    return {
      periode: { startDate, endDate },
      accounts: byAccount,
      totalDebit: entries.reduce((sum, e) => sum + Number(e.montantDebit), 0),
      totalCredit: entries.reduce((sum, e) => sum + Number(e.montantCredit), 0),
    };
  }

  /**
   * Journal export
   */
  async exportJournal(journalCode: JournalCode, startDate: string, endDate: string): Promise<any[]> {
    return this.entryRepo.find({
      where: {
        journalCode,
        dateEcriture: Between(new Date(startDate), new Date(endDate)),
      },
      order: { dateEcriture: 'ASC' },
    });
  }

  // ==================== UTILITIES ====================

  private async generateEntryReference(journalCode: JournalCode): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.entryRepo.count({
      where: { journalCode },
    });
    return `${journalCode}-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
