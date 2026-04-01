import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Encaissement } from './encaissement.entity';
import { Decaissement } from './decaissement.entity';

export enum MovementType {
  ENCAISSEMENT = 'encaissement',
  DECAISSEMENT = 'decaissement',
}

@Entity('bank_movements')
export class BankMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column({ type: 'date' })
  dateMovement: Date;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @ManyToOne(() => Encaissement, { nullable: true })
  @JoinColumn()
  encaissement: Encaissement;

  @Column({ nullable: true })
  encaissementId: string;

  @ManyToOne(() => Decaissement, { nullable: true })
  @JoinColumn()
  decaissement: Decaissement;

  @Column({ nullable: true })
  decaissementId: string;

  @Column()
  compteBancaire: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  soldeAvant: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  soldeApres: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  reconcilie: boolean;

  @Column({ type: 'date', nullable: true })
  dateReconciliation: Date;

  @CreateDateColumn()
  createdAt: Date;
}
