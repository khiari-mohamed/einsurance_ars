import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';

export enum SlipType {
  COTATION = 'cotation',
  COUVERTURE = 'couverture',
}

@Entity('slips')
export class Slip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ type: 'enum', enum: SlipType })
  type: SlipType;

  @ManyToOne(() => Affaire)
  @JoinColumn()
  affaire: Affaire;

  @ManyToOne(() => Reassureur)
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  partReassureur: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  primeReassureur: number;

  @Column({ type: 'date' })
  dateEmission: Date;

  @Column({ nullable: true })
  documentPath: string;

  @CreateDateColumn()
  createdAt: Date;
}
