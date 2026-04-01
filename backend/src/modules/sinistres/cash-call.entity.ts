import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Sinistre } from './sinistres.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { User } from '../users/users.entity';

export enum CashCallStatus {
  INITIATED = 'initiated',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum CashCallUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

@Entity('cash_calls')
export class CashCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @ManyToOne(() => Sinistre, { eager: true })
  @JoinColumn()
  sinistre: Sinistre;

  @Index()
  @Column()
  sinistreId: string;

  @ManyToOne(() => Reassureur, { eager: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Index()
  @Column()
  reassureurId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantDemande: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantRecu: number;

  @Column({ default: 'TND' })
  devise: string;

  @Index()
  @Column({ type: 'enum', enum: CashCallStatus, default: CashCallStatus.INITIATED })
  statut: CashCallStatus;

  @Column({ type: 'enum', enum: CashCallUrgency, default: CashCallUrgency.NORMAL })
  urgence: CashCallUrgency;

  @Column({ type: 'date' })
  dateEmission: Date;

  @Column({ type: 'date' })
  dateEcheance: Date;

  @Column({ type: 'date', nullable: true })
  datePaiement: Date;

  @Column({ type: 'text' })
  motif: string;

  @Column({ type: 'text', nullable: true })
  justification: string;

  @Column({ type: 'jsonb', default: [] })
  communications: Array<{
    date: Date;
    type: 'email' | 'phone' | 'fax' | 'portal';
    message: string;
    sentBy: string;
    response?: string;
  }>;

  @Column({ type: 'jsonb', default: [] })
  suivis: Array<{
    date: Date;
    action: string;
    user: string;
    notes?: string;
  }>;

  @Column({ nullable: true })
  referencePaiement: string;

  @Column({ default: false })
  rappelEnvoye: boolean;

  @Column({ type: 'int', default: 0 })
  nombreRappels: number;

  @Column({ type: 'date', nullable: true })
  dateDernierRappel: Date;

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
