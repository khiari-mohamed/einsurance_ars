import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

export enum JournalCode {
  VTE = 'vte', // Journal des ventes
  ACH = 'ach', // Journal des achats
  BNQ = 'bnq', // Journal bancaire
  OPE = 'ope', // Journal opérations diverses
}

export enum AccountingEntryStatus {
  BROUILLON = 'brouillon',
  SAISIE = 'saisie',
  VALIDEE = 'validee',
  COMPTABILISEE = 'comptabilisee',
  ANNULEE = 'annulee',
}

@Entity('accounting_entries')
@Index(['journalCode', 'dateEcriture'])
@Index(['compteDebit', 'compteCredit'])
@Index(['referencePiece'])
export class AccountingEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // AUTO: JNL-YYYY-XXXXX

  @Column({ type: 'enum', enum: JournalCode })
  journalCode: JournalCode;

  @Column({ type: 'date' })
  dateEcriture: Date;

  @Column({ type: 'date' })
  dateValeur: Date;

  // Account codes (Tunisian chart of accounts)
  @Column()
  compteDebit: string; // e.g., 411xxx (Clients), 512xxx (Banque)

  @Column()
  compteCredit: string; // e.g., 705xxx (Revenue), 401xxx (Suppliers)

  @Column({ type: 'text', nullable: true })
  libelleCompteDebit: string;

  @Column({ type: 'text', nullable: true })
  libelleCompteCredit: string;

  // Amount
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantDebit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantCredit: number;

  // Multi-currency support
  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1 })
  tauxChange: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  montantDevise: number;

  // Gain/Perte de change (if applicable)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gainPertChange: number;

  // Linked reference
  @Column({ type: 'enum', enum: ['ENCAISSEMENT', 'DECAISSEMENT', 'SETTLEMENT', 'COMMISSION', 'SINISTRE'] })
  typeReference: string;

  @Column()
  idReference: string; // encaissementId, decaissementId, etc.

  @Column({ nullable: true })
  referencePiece: string; // bordereau, commande, invoice, etc.

  // Description
  @Column({ type: 'text' })
  libelle: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Cost center (optional)
  @Column({ nullable: true })
  centreCout: string;

  // Status
  @Column({ type: 'enum', enum: AccountingEntryStatus, default: AccountingEntryStatus.BROUILLON })
  statut: AccountingEntryStatus;

  // Validation
  @Column({ nullable: true })
  valideParId: string;

  @Column({ type: 'timestamp', nullable: true })
  dateValidation: Date;

  // Audit trail
  @Column({ type: 'jsonb', default: [] })
  historique: Array<{
    date: Date;
    action: string;
    user: string;
    details?: string;
  }>;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
