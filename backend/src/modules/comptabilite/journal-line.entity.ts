import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';

@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => JournalEntry, entry => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn()
  journalEntry: JournalEntry;

  @Column()
  journalEntryId: string;

  @Column()
  accountNumber: string;

  @Column()
  accountLabel: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  auxiliaryAccountId: string;
}
