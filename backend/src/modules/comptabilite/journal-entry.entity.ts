import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/users.entity';
import { JournalLine } from './journal-line.entity';

export enum JournalType {
  VENTES = 'ventes',
  ACHATS = 'achats',
  BANQUE = 'banque',
  CAISSE = 'caisse',
  DIVERS = 'divers',
}

export enum EntryStatus {
  BROUILLON = 'brouillon',
  VALIDE = 'valide',
  COMPTABILISE = 'comptabilise',
  ANNULE = 'annule',
}

@Entity('journal_entries')
@Index(['journalType', 'entryDate'])
@Index(['reference'], { unique: true })
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column({ type: 'date' })
  entryDate: Date;

  @Column({ type: 'enum', enum: JournalType })
  journalType: JournalType;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  bordereauId: string;

  @Column({ nullable: true })
  encaissementId: string;

  @Column({ nullable: true })
  decaissementId: string;

  @Column({ nullable: true })
  sinistreId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalDebit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalCredit: number;

  @Column({ default: false })
  isBalanced: boolean;

  @Column({ type: 'enum', enum: EntryStatus, default: EntryStatus.BROUILLON })
  status: EntryStatus;

  @Column({ nullable: true })
  validatedById: string;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validatedById' })
  validatedBy: User;

  @Column({ type: 'text', nullable: true })
  validationNotes: string;

  @Column({ type: 'jsonb', default: [] })
  historique: Array<{
    date: Date;
    action: string;
    user: string;
    oldStatus?: string;
    newStatus?: string;
    notes?: string;
  }>;

  @Column({ default: false })
  exported: boolean;

  @Column({ type: 'timestamp', nullable: true })
  exportedAt: Date;

  @OneToMany(() => JournalLine, line => line.journalEntry, { cascade: true, eager: true })
  lines: JournalLine[];

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
