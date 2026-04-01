import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('exchange_rates')
@Index(['devise', 'dateRate'], { unique: true })
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  devise: string; // EUR, USD, GBP, etc.

  @Column({ type: 'date' })
  dateRate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  tauxBCT: number; // Official BCT rate

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  tauxARS: number; // ARS rate (may differ slightly for fees)

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  tauxVente: number; // Selling rate

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  tauxAchat: number; // Buying rate

  // Source
  @Column({ default: 'BCT' })
  source: string;

  @Column({ type: 'timestamp', nullable: true })
  dateRecuperation: Date;

  // Metadata
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
