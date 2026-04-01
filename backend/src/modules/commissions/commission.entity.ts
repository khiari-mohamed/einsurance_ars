import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';

export enum CommissionType {
  CEDANTE = 'cedante',
  ARS = 'ars',
  CO_COURTIER = 'co_courtier',
}

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Affaire)
  @JoinColumn()
  affaire: Affaire;

  @Column({ type: 'enum', enum: CommissionType })
  type: CommissionType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  taux: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column()
  devise: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  montantTND: number;

  @CreateDateColumn()
  createdAt: Date;
}
