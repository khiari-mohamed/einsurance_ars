import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { BankMovement, MovementType } from './bank-movement.entity';
import { Encaissement, EncaissementStatus } from './encaissement.entity';
import { Decaissement, DecaissementStatus } from './decaissement.entity';
import { AccountingEntry } from './accounting-entry.entity';
import { NotificationService } from './notification.service';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

export interface BankStatement {
  accountNumber: string;
  statements: Array<{
    date: Date;
    description: string;
    montant: number;
    direction: 'CREDIT' | 'DEBIT';
    solde: number;
    referenceBank: string;
  }>;
}

export interface ReconciliationResult {
  accountNumber: string;
  dateReconciliation: Date;
  soldeBank: number;
  soldeSystem: number;
  soldeAccounting: number;
  difference: number;
  matched: number;
  unmatched: number;
  discrepancies: Array<{
    type: 'MISSING_SYSTEM' | 'MISSING_BANK' | 'AMOUNT_MISMATCH';
    reference: string;
    montantBank: number;
    montantSystem: number;
    date: Date;
  }>;
  status: 'RECONCILED' | 'REQUIRES_REVIEW' | 'DISCREPANCIES_FOUND';
}

@Injectable()
export class BankReconciliationService {
  constructor(
    @InjectRepository(BankMovement)
    private bankMovementRepo: Repository<BankMovement>,
    @InjectRepository(Encaissement)
    private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(AccountingEntry)
    private accountingEntryRepo: Repository<AccountingEntry>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private notificationService: NotificationService,
  ) {}

  /**
   * Import bank statement from CSV/Excel
   */
  async importBankStatement(
    accountNumber: string,
    statements: Array<{
      date: string;
      description: string;
      montant: number;
      direction: 'CREDIT' | 'DEBIT';
      solde: number;
      referenceBank: string;
    }>,
    userId: string,
  ): Promise<{ imported: number; validated: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    let validated = 0;

    for (const stmt of statements) {
      try {
        const date = new Date(stmt.date);

        // Validate statement
        if (isNaN(date.getTime())) {
          errors.push(`Invalid date: ${stmt.date}`);
          continue;
        }

        if (stmt.montant < 0) {
          errors.push(`Negative amount not allowed: ${stmt.montant}`);
          continue;
        }

        // Check for duplicate
        const existing = await this.bankMovementRepo.findOne({
          where: {
            compteBancaire: accountNumber,
            dateMovement: date,
            montant: Math.abs(stmt.montant),
          },
        });

        if (existing) {
          errors.push(`Duplicate entry found: ${stmt.referenceBank} on ${stmt.date}`);
          continue;
        }

        // Auto-match with system movements
        const matched = await this.matchBankMovement(accountNumber, stmt, userId);

        if (matched) {
          validated++;
        }

        imported++;
      } catch (error) {
        errors.push(`Error processing statement: ${error.message}`);
      }
    }

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.ACCOUNTING_ENTRY,
      entityId: accountNumber,
      userId,
      userEmail: '',
      description: `Bank statement imported: ${imported} statements, ${validated} validated`,
      afterValues: { imported, validated, errorCount: errors.length },
    });

    return { imported, validated, errors };
  }

  /**
   * Perform three-way reconciliation: Bank vs System vs Accounting
   */
  async reconcileAccount(
    accountNumber: string,
    endDate: string,
    userId: string,
  ): Promise<ReconciliationResult> {
    const dateEnd = new Date(endDate);

    // Get bank movements
    const bankMovements = await this.bankMovementRepo.find({
      where: {
        compteBancaire: accountNumber,
        dateMovement: Between(new Date('2024-01-01'), dateEnd),
      },
    });

    const soldeBank = bankMovements.length > 0 
      ? bankMovements[bankMovements.length - 1].soldeApres 
      : 0;

    // Get system movements (Encaissement + Décaissement)
    const encaissements = await this.encaissementRepo.find({
      where: {
        dateEncaissement: Between(new Date('2024-01-01'), dateEnd),
        statut: In([EncaissementStatus.VALIDE, EncaissementStatus.COMPTABILISE]),
      },
    });

    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(new Date('2024-01-01'), dateEnd),
        statut: In([DecaissementStatus.EXECUTE, DecaissementStatus.COMPTABILISE]),
      },
    });

    const soldeSystem =
      encaissements.reduce((sum, e) => sum + Number(e.montantEquivalentTND), 0) -
      decaissements.reduce((sum, d) => sum + Number(d.montantEquivalentTND), 0);

    // Get accounting entries
    const accountingEntries = await this.accountingEntryRepo.find({
      where: {
        dateEcriture: Between(new Date('2024-01-01'), dateEnd),
      },
    });

    const soldeAccounting =
      accountingEntries.reduce((sum, e) => sum + Number(e.montantDebit), 0) -
      accountingEntries.reduce((sum, e) => sum + Number(e.montantCredit), 0);

    // Find discrepancies
    const discrepancies: ReconciliationResult['discrepancies'] = [];
    let matched = 0;

    for (const enc of encaissements) {
      const foundInBank = bankMovements.find(bm =>
        bm.type === MovementType.ENCAISSEMENT &&
        Math.abs(Number(enc.montantEquivalentTND) - bm.montant) < 1,
      );

      if (foundInBank) {
        matched++;
      } else {
        discrepancies.push({
          type: 'MISSING_BANK',
          reference: enc.numero,
          montantBank: 0,
          montantSystem: Number(enc.montantEquivalentTND),
          date: new Date(enc.dateEncaissement),
        });
      }
    }

    for (const dec of decaissements) {
      const foundInBank = bankMovements.find(bm =>
        bm.type === MovementType.DECAISSEMENT &&
        Math.abs(Number(dec.montantEquivalentTND) - bm.montant) < 1,
      );

      if (foundInBank) {
        matched++;
      } else {
        discrepancies.push({
          type: 'MISSING_BANK',
          reference: dec.numero,
          montantBank: 0,
          montantSystem: Number(dec.montantEquivalentTND),
          date: new Date(dec.dateDecaissement),
        });
      }
    }

    const difference = Math.abs(soldeBank - soldeSystem);
    const status =
      difference === 0 && discrepancies.length === 0
        ? 'RECONCILED'
        : discrepancies.length > 0
          ? 'DISCREPANCIES_FOUND'
          : 'REQUIRES_REVIEW';

    const result: ReconciliationResult = {
      accountNumber,
      dateReconciliation: new Date(),
      soldeBank,
      soldeSystem,
      soldeAccounting,
      difference,
      matched,
      unmatched: bankMovements.length - matched,
      discrepancies,
      status,
    };

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.RECONCILE,
      entityType: AuditEntityType.ACCOUNTING_ENTRY,
      entityId: accountNumber,
      userId,
      userEmail: '',
      severity: status === 'RECONCILED' ? 'LOW' : 'MEDIUM',
      description: `Account reconciliation completed: ${status} - Difference: ${difference.toFixed(2)} TND`,
      afterValues: result,
      requiresReview: status !== 'RECONCILED',
    });

    // Send email alert if discrepancies found
    if (discrepancies.length > 0) {
      await this.notificationService.sendReconciliationAlertEmail(discrepancies, accountNumber);
    }

    return result;
  }

  /**
   * Mark movements as reconciled
   */
  async markAsReconciled(
    accountNumber: string,
    endDate: string,
    userId: string,
  ): Promise<number> {
    const dateEnd = new Date(endDate);

    const movements = await this.bankMovementRepo.find({
      where: {
        compteBancaire: accountNumber,
        dateMovement: Between(new Date('2024-01-01'), dateEnd),
        reconcilie: false,
      },
    });

    for (const movement of movements) {
      movement.reconcilie = true;
      movement.dateReconciliation = new Date();
      await this.bankMovementRepo.save(movement);
    }

    await this.auditLogRepo.save({
      actionType: AuditActionType.RECONCILE,
      entityType: AuditEntityType.ACCOUNTING_ENTRY,
      entityId: accountNumber,
      userId,
      userEmail: '',
      description: `Marked ${movements.length} movements as reconciled for account ${accountNumber}`,
      afterValues: { reconciled: movements.length },
    });

    return movements.length;
  }

  /**
   * Get unreconciled items report
   */
  async getUnreconciledReport(accountNumber: string): Promise<any> {
    const unreconciledMovements = await this.bankMovementRepo.find({
      where: {
        compteBancaire: accountNumber,
        reconcilie: false,
      },
      order: { dateMovement: 'ASC' },
    });

    const unreconciledEncaissements = await this.encaissementRepo.find({
      where: {
        statut: EncaissementStatus.SAISI,
      },
    });

    const unreconciledDecaissements = await this.decaissementRepo.find({
      where: {
        statut: DecaissementStatus.BROUILLON,
      },
    });

    const totalUnreconciledAmount =
      unreconciledMovements.reduce((sum, m) => sum + m.montant, 0) +
      unreconciledEncaissements.reduce((sum, e) => sum + Number(e.montantEquivalentTND), 0) +
      unreconciledDecaissements.reduce((sum, d) => sum + Number(d.montantEquivalentTND), 0);

    const oldestItem = [...unreconciledMovements, ...unreconciledEncaissements, ...unreconciledDecaissements].sort(
      (a, b) => {
        const dateA = 'dateMovement' in a ? a.dateMovement : a.createdAt;
        const dateB = 'dateMovement' in b ? b.dateMovement : b.createdAt;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      },
    )[0];

    return {
      accountNumber,
      unreconciledMovements: unreconciledMovements.length,
      unreconciledEncaissements: unreconciledEncaissements.length,
      unreconciledDecaissements: unreconciledDecaissements.length,
      totalUnreconciledAmount,
      oldestItemAge: oldestItem ? this.getDaysDifference(new Date(), new Date('dateMovement' in oldestItem ? oldestItem.dateMovement : oldestItem.createdAt)) : 0,
      items: {
        movements: unreconciledMovements,
        encaissements: unreconciledEncaissements,
        decaissements: unreconciledDecaissements,
      },
      recommendation: totalUnreconciledAmount > 0 ? 'Review and reconcile outstanding items' : 'No unreconciled items',
    };
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(accountNumber: string, days: number = 90): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const history = await this.auditLogRepo.find({
      where: {
        entityId: accountNumber,
        actionType: AuditActionType.RECONCILE,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return history.map(h => ({
      date: h.createdAt,
      description: h.description,
      status: h.afterValues?.status || 'UNKNOWN',
      difference: h.afterValues?.difference || 0,
      user: h.userId,
    }));
  }

  // ==================== PRIVATE HELPERS ====================

  private async matchBankMovement(
    accountNumber: string,
    bankStatement: any,
    userId: string,
  ): Promise<BankMovement | null> {
    const movementType = bankStatement.direction === 'CREDIT' ? MovementType.ENCAISSEMENT : MovementType.DECAISSEMENT;
    const montant = Math.abs(bankStatement.montant);

    // Try to find matching encaissement or décaissement
    if (movementType === MovementType.ENCAISSEMENT) {
      const encaissement = await this.encaissementRepo.findOne({
        where: {
          dateEncaissement: Between(
            new Date(new Date(bankStatement.date).getTime() - 3 * 24 * 60 * 60 * 1000),
            new Date(new Date(bankStatement.date).getTime() + 3 * 24 * 60 * 60 * 1000),
          ),
        },
      });

      if (encaissement && Math.abs(Number(encaissement.montantEquivalentTND) - montant) < 1) {
        // Create bank movement linked to encaissement
        const lastMovement = await this.bankMovementRepo.findOne({
          where: { compteBancaire: accountNumber },
          order: { createdAt: 'DESC' },
        });

        const soldeAvant = lastMovement?.soldeApres || 0;
        const soldeApres = soldeAvant + montant;

        return this.bankMovementRepo.save({
          reference: bankStatement.referenceBank,
          dateMovement: new Date(bankStatement.date),
          type: movementType,
          encaissementId: encaissement.id,
          compteBancaire: accountNumber,
          montant,
          devise: encaissement.devise,
          soldeAvant,
          soldeApres,
          description: bankStatement.description,
          reconcilie: true,
          dateReconciliation: new Date(),
        });
      }
    }

    return null;
  }

  private getDaysDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date1.getTime() - date2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
