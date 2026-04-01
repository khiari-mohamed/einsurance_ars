import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Bordereau } from './bordereaux.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';

export enum TypeLigne {
  PRIME = 'prime',
  SINISTRE = 'sinistre',
  COMMISSION = 'commission',
  FRAIS = 'frais',
}

@Entity('bordereau_lignes')
export class BordereauLigne {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bordereau, bordereau => bordereau.lignes, { onDelete: 'CASCADE' })
  @JoinColumn()
  bordereau: Bordereau;

  @Column()
  bordereauId: string;

  @ManyToOne(() => Affaire, { eager: true })
  @JoinColumn()
  affaire: Affaire;

  @Column()
  affaireId: string;

  @ManyToOne(() => Reassureur, { nullable: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ nullable: true })
  reassureurId: string;

  @Column({ type: 'int' })
  numLigne: number;

  @Column({ type: 'enum', enum: TypeLigne, default: TypeLigne.PRIME })
  typeLigne: TypeLigne;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantBrut: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxCession: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantCede: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  partReassureur: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionMontant: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  montantSinistre: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  netAPayer: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}