import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Reassureur } from '../reassureurs/reassureurs.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('payment_orders')
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @ManyToOne(() => Reassureur)
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column()
  devise: string;

  @Column({ type: 'date' })
  dateEmission: Date;

  @Column({ type: 'date', nullable: true })
  datePaiement: Date;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  swiftReference: string;

  @CreateDateColumn()
  createdAt: Date;
}
