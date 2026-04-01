import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Affaire } from '../affaires.entity';

export enum InstalmentStatus {
  PENDING = 'pending',
  DUE = 'due',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('pmd_instalments')
export class PMDInstalment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Affaire, { onDelete: 'CASCADE' })
  @JoinColumn()
  affaire: Affaire;

  @Index()
  @Column()
  affaireId: string;

  @Column({ type: 'int' })
  numeroEcheance: number;

  @Column({ type: 'date' })
  dateEcheance: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  pourcentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantPaye: number;

  @Column({ type: 'date', nullable: true })
  datePaiement: Date;

  @Index()
  @Column({ type: 'enum', enum: InstalmentStatus, default: InstalmentStatus.PENDING })
  statut: InstalmentStatus;

  @Column({ nullable: true })
  referencePaiement: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  rappelEnvoye: boolean;

  @Column({ type: 'date', nullable: true })
  dateRappel: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
