import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';

export enum TraiteType {
  QP = 'qp',
  XOL = 'xol',
  SURPLUS = 'surplus',
  STOP_LOSS = 'stop_loss',
}

@Entity('traites')
export class Traite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numeroTraite: string;

  @Column({ type: 'enum', enum: TraiteType })
  type: TraiteType;

  @ManyToOne(() => Cedante)
  @JoinColumn()
  cedante: Cedante;

  @Column({ nullable: true })
  branche: string;

  @Column({ type: 'date' })
  dateEffet: Date;

  @Column({ type: 'date' })
  dateEcheance: Date;

  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primePrevisionnelle: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  pmd: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
