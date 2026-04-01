import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  LOCKED = 'locked',
}

@Entity('fiscal_periods')
@Index(['exercice', 'mois'], { unique: true })
export class FiscalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exercice: number;

  @Column()
  mois: number;

  @Column()
  code: string;

  @Column({ type: 'date' })
  dateDebut: Date;

  @Column({ type: 'date' })
  dateFin: Date;

  @Column({ type: 'enum', enum: PeriodStatus, default: PeriodStatus.OPEN })
  statut: PeriodStatus;

  @Column({ nullable: true })
  closedById: string;

  @Column({ type: 'timestamp', nullable: true })
  dateCloture: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
