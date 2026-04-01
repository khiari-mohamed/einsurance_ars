import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry, JournalType, EntryStatus } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { AuxiliaryAccount } from './auxiliary-account.entity';
import { Bordereau, BordereauType } from '../bordereaux/bordereaux.entity';
import { Encaissement } from '../finances/encaissement.entity';
import { Decaissement } from '../finances/decaissement.entity';
import { ARS_ACCOUNT_CODES } from './comptabilite.constants';

@Injectable()
export class AccountingEngineService {
  constructor(
    @InjectRepository(JournalEntry) private journalRepo: Repository<JournalEntry>,
    @InjectRepository(JournalLine) private lineRepo: Repository<JournalLine>,
    @InjectRepository(AuxiliaryAccount) private auxRepo: Repository<AuxiliaryAccount>,
  ) {}

  async generateBordereauEntries(bordereau: Bordereau, userId: string): Promise<JournalEntry> {
    const lines: Partial<JournalLine>[] = [];

    if (bordereau.type === BordereauType.CESSION) {
      const cedanteAccount = await this.getAuxiliaryAccount('cedante', bordereau.cedanteId);
      
      lines.push({
        accountNumber: cedanteAccount,
        accountLabel: `Cédante - ${bordereau.cedante?.raisonSociale}`,
        debit: Number(bordereau.primeTotale),
        credit: 0,
        description: `Prime cédée ${bordereau.numero}`,
      });

      lines.push({
        accountNumber: ARS_ACCOUNT_CODES.COMMISSION_ARS,
        accountLabel: 'Commission ARS',
        debit: 0,
        credit: Number(bordereau.commissionARS),
        description: `Commission ARS ${bordereau.numero}`,
      });

      lines.push({
        accountNumber: ARS_ACCOUNT_CODES.COMMISSION_CEDANTE,
        accountLabel: 'Commission cédante',
        debit: 0,
        credit: Number(bordereau.commissionCedante),
        description: `Commission cédante ${bordereau.numero}`,
      });

      const balance = Number(bordereau.primeTotale) - Number(bordereau.commissionARS) - Number(bordereau.commissionCedante);
      if (Math.abs(balance) > 0.01) {
        lines.push({
          accountNumber: ARS_ACCOUNT_CODES.PRIMES_ACQUISES,
          accountLabel: 'Primes acquises',
          debit: 0,
          credit: balance,
          description: `Solde prime ${bordereau.numero}`,
        });
      }
    }

    if (bordereau.type === BordereauType.REASSUREUR) {
      const reassureurAccount = await this.getAuxiliaryAccount('reassureur', bordereau.reassureurId);
      
      lines.push({
        accountNumber: ARS_ACCOUNT_CODES.PRIMES_CEDEES,
        accountLabel: 'Primes cédées réassureurs',
        debit: Number(bordereau.primeTotale) - Number(bordereau.commissionARS),
        credit: 0,
        description: `Prime cédée réassureur ${bordereau.numero}`,
      });

      lines.push({
        accountNumber: reassureurAccount,
        accountLabel: `Réassureur - ${bordereau.reassureur?.raisonSociale}`,
        debit: 0,
        credit: Number(bordereau.primeTotale) - Number(bordereau.commissionARS),
        description: `Dette réassureur ${bordereau.numero}`,
      });
    }

    return this.createJournalEntry({
      journalType: bordereau.type === BordereauType.CESSION ? JournalType.VENTES : JournalType.ACHATS,
      entryDate: new Date(bordereau.dateEmission),
      description: `Bordereau ${bordereau.type} ${bordereau.numero}`,
      bordereauId: bordereau.id,
      lines,
      userId,
    });
  }

  async generateEncaissementEntry(encaissement: Encaissement, userId: string): Promise<JournalEntry> {
    const lines: Partial<JournalLine>[] = [];
    const sourceAccount = await this.getAuxiliaryAccount(encaissement.sourceType, encaissement.cedanteId || encaissement.clientId);

    lines.push({
      accountNumber: ARS_ACCOUNT_CODES.BANK_MAIN,
      accountLabel: `Banque ${encaissement.devise}`,
      debit: Number(encaissement.montantEquivalentTND),
      credit: 0,
      description: `Encaissement ${encaissement.numero}`,
    });

    lines.push({
      accountNumber: sourceAccount,
      accountLabel: `Client - ${encaissement.sourceType}`,
      debit: 0,
      credit: Number(encaissement.montantEquivalentTND),
      description: `Règlement ${encaissement.numero}`,
    });

    return this.createJournalEntry({
      journalType: JournalType.BANQUE,
      entryDate: new Date(encaissement.dateEncaissement),
      description: `Encaissement ${encaissement.numero}`,
      encaissementId: encaissement.id,
      lines,
      userId,
    });
  }

  async generateDecaissementEntry(decaissement: Decaissement, userId: string): Promise<JournalEntry> {
    const lines: Partial<JournalLine>[] = [];
    const benefAccount = await this.getAuxiliaryAccount(decaissement.beneficiaireType, decaissement.reassureurId || decaissement.cedanteId);

    lines.push({
      accountNumber: benefAccount,
      accountLabel: `Fournisseur - ${decaissement.beneficiaireType}`,
      debit: Number(decaissement.montantEquivalentTND),
      credit: 0,
      description: `Paiement ${decaissement.numero}`,
    });

    lines.push({
      accountNumber: ARS_ACCOUNT_CODES.BANK_MAIN,
      accountLabel: 'Banque',
      debit: 0,
      credit: Number(decaissement.montantEquivalentTND),
      description: `Décaissement ${decaissement.numero}`,
    });

    if (Number(decaissement.fraisBancaires) > 0) {
      lines.push({
        accountNumber: ARS_ACCOUNT_CODES.FRAIS_BANCAIRES,
        accountLabel: 'Frais bancaires',
        debit: Number(decaissement.fraisBancaires),
        credit: 0,
        description: `Frais ${decaissement.numero}`,
      });
    }

    return this.createJournalEntry({
      journalType: JournalType.BANQUE,
      entryDate: new Date(decaissement.dateDecaissement),
      description: `Décaissement ${decaissement.numero}`,
      decaissementId: decaissement.id,
      lines,
      userId,
    });
  }

  async generateSinistreEntries(sinistre: any, userId: string): Promise<JournalEntry> {
    const lines: Partial<JournalLine>[] = [];

    lines.push({
      accountNumber: ARS_ACCOUNT_CODES.SINISTRES_A_PAYER,
      accountLabel: 'Sinistres à payer',
      debit: Number(sinistre.montantReassurance),
      credit: 0,
      description: `Sinistre ${sinistre.numero}`,
    });

    for (const participation of sinistre.participations || []) {
      const reassureurAccount = await this.getAuxiliaryAccount('reassureur', participation.reassureurId);
      lines.push({
        accountNumber: reassureurAccount,
        accountLabel: `Réassureur - ${participation.reassureur?.raisonSociale}`,
        debit: 0,
        credit: Number(participation.montantPart),
        description: `Part réassureur sinistre ${sinistre.numero}`,
      });
    }

    return this.createJournalEntry({
      journalType: JournalType.DIVERS,
      entryDate: new Date(sinistre.dateDeclarationCedante),
      description: `Sinistre ${sinistre.numero}`,
      sinistreId: sinistre.id,
      lines,
      userId,
    });
  }

  private async createJournalEntry(data: {
    journalType: JournalType;
    entryDate: Date;
    description: string;
    lines: Partial<JournalLine>[];
    userId: string;
    bordereauId?: string;
    encaissementId?: string;
    decaissementId?: string;
    sinistreId?: string;
  }): Promise<JournalEntry> {
    const totalDebit = data.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (!isBalanced) {
      throw new BadRequestException(`Entry not balanced: Debit=${totalDebit}, Credit=${totalCredit}`);
    }

    const reference = await this.generateReference(data.journalType);

    const entry = this.journalRepo.create({
      reference,
      journalType: data.journalType,
      entryDate: data.entryDate,
      description: data.description,
      bordereauId: data.bordereauId,
      encaissementId: data.encaissementId,
      decaissementId: data.decaissementId,
      sinistreId: data.sinistreId,
      totalDebit,
      totalCredit,
      isBalanced,
      status: EntryStatus.VALIDE,
      createdById: data.userId,
    });

    const saved = await this.journalRepo.save(entry);

    const lines = data.lines.map(l => this.lineRepo.create({
      ...l,
      journalEntryId: saved.id,
    }));

    await this.lineRepo.save(lines);

    return this.journalRepo.findOne({ where: { id: saved.id }, relations: ['lines'] });
  }

  private async getAuxiliaryAccount(entityType: string, entityId: string): Promise<string> {
    const aux = await this.auxRepo.findOne({ where: { entityType: entityType as any, entityId } });
    if (!aux) {
      throw new BadRequestException(`Auxiliary account not found for ${entityType} ${entityId}`);
    }
    return aux.accountNumber;
  }

  private async generateReference(journalType: JournalType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = journalType.toUpperCase().substring(0, 3);
    const count = await this.journalRepo.count({ where: { journalType } });
    return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
