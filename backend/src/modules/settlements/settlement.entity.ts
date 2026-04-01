import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';

export enum SettlementStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  CLOSED = 'closed',
}

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @ManyToOne(() => Cedante, { nullable: true })
  @JoinColumn()
  cedante: Cedante;

  @ManyToOne(() => Reassureur, { nullable: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ type: 'date' })
  dateDebut: Date;

  @Column({ type: 'date' })
  dateFin: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantTotal: number;

  @Column()
  devise: string;

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.DRAFT })
  status: SettlementStatus;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @CreateDateColumn()
  createdAt: Date;
}
