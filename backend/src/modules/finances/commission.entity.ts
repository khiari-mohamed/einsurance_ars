import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { CoCourtier } from '../co-courtiers/co-courtiers.entity';
import { User } from '../users/users.entity';

export enum CommissionType {
  ARS = 'ars',
  CEDANTE = 'cedante',
  COURTIER = 'courtier',
}

export enum CommissionStatus {
  CALCULEE = 'calculee',
  A_PAYER = 'a_payer',
  PAYEE = 'payee',
  ANNULEE = 'annulee',
}

export enum CalculationBase {
  PRIME_100 = 'prime_100',
  PRIME_CEDEE = 'prime_cedee',
  SINISTRE = 'sinistre',
}

@Entity('commissions')
// @Index(['affaireId', 'type', 'statut'])
// @Index(['datePaiement'])
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ type: 'enum', enum: CommissionType })
  type: CommissionType;

  // Linked transaction
  @ManyToOne(() => Affaire, { eager: true })
  @JoinColumn()
  affaire: Affaire;

  @Column()
  affaireId: string;

  @ManyToOne(() => Bordereau, { nullable: true, eager: true })
  @JoinColumn()
  bordereau: Bordereau;

  @Column({ nullable: true })
  bordereauId: string;

  // Optional: Beneficiaries for commission cedante/courtier
  @ManyToOne(() => Cedante, { nullable: true })
  @JoinColumn()
  cedante: Cedante;

  @Column({ nullable: true })
  cedanteId: string;

  @ManyToOne(() => CoCourtier, { nullable: true })
  @JoinColumn()
  courtier: CoCourtier;

  @Column({ nullable: true })
  courtierId: string;

  // Calculation parameters
  @Column({ type: 'enum', enum: CalculationBase })
  baseCalcul: CalculationBase;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  baseMontant: number; // The amount on which commission is calculated

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  taux: number; // Percentage (e.g., 12.5 for 12.5%)

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number; // Calculated commission amount

  // Validation fields
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  tauxMax: number; // Maximum allowed rate for this commission

  @Column({ default: false })
  tauxOverride: boolean; // If rate was manually overridden

  @Column({ nullable: true })
  overrideReason: string;

  @Column({ nullable: true })
  overrideByUserId: string;

  // Payment tracking
  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.CALCULEE })
  statut: CommissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  dateCalcul: Date;

  @Column({ type: 'timestamp', nullable: true })
  datePaiement: Date;

  // Link to payment if commission is paid via décaissement
  @Column({ nullable: true })
  decaissementId: string;

  // Accounting integration
  @Column({ nullable: true })
  compteComptable: string; // 70510000 for ARS commission, etc.

  @Column({ nullable: true })
  pieceComptable: string; // Accounting entry reference

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: [] })
  historique: Array<{
    date: Date;
    action: string;
    user: string;
    details?: string;
  }>;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
