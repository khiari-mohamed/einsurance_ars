import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ledger_entries')
@Index(['accountCode', 'periode'])
@Index(['periode'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountCode: string;

  @Column()
  accountLabel: string;

  @Column({ type: 'date' })
  dateOperation: Date;

  @Column()
  periode: string;

  @Column()
  journalCode: string;

  @Column()
  pieceReference: string;

  @Column({ type: 'text' })
  libelle: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  solde: number;

  @Column()
  accountingEntryId: string;

  @CreateDateColumn()
  createdAt: Date;
}
