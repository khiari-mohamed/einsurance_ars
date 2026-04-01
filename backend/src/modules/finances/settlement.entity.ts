import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { User } from '../users/users.entity';

export enum SettlementType {
  MENSUELLE = 'mensuelle',
  TRIMESTRIELLE = 'trimestrielle',
  SEMESTRIELLE = 'semestrielle',
  ANNUELLE = 'annuelle',
}

export enum SettlementStatus {
  EN_COURS = 'en_cours',
  CALCULEE = 'calculee',
  VALIDEE = 'validee',
  ENVOYEE = 'envoyee',
  REGLEE = 'reglee',
  ANNULEE = 'annulee',
}

@Entity('settlements')
// @Index(['cedanteId', 'type', 'statut'])
// @Index(['dateDebut', 'dateFin'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ type: 'enum', enum: SettlementType })
  type: SettlementType;

  @Column({ type: 'date' })
  dateDebut: Date;

  @Column({ type: 'date' })
  dateFin: Date;

  // Linked parties
  @ManyToOne(() => Cedante, { eager: true })
  @JoinColumn()
  cedante: Cedante;

  @Column()
  cedanteId: string;

  @ManyToOne(() => Reassureur, { nullable: true, eager: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ nullable: true })
  reassureurId: string;

  // Summary totals
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPrime: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCommissionCedante: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCommissionARS: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCommissionCourtier: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSinistre: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAPayer: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  soldePrecedent: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  soldeFinal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gainPerteChange: number;

  // Detailed lines stored as JSONB
  @Column({ type: 'jsonb', default: [] })
  lignes: Array<{
    affaireId: string;
    referenceBordereau: string;
    type: 'FACULTATIVE' | 'TRAITE';
    prime100: number;
    primeCedee: number;
    tauxCession: number;
    commissionCedante: number;
    commissionARS: number;
    commissionCourtier: number;
    sinistreMontant: number;
    netAPayer: number;
    statutPaiement: 'IMPAYE' | 'PARTIEL' | 'PAYE';
    encaissementId?: string;
    decaissementId?: string;
  }>;

  // Document references
  @Column({ nullable: true })
  bordereauSituationId: string;

  @Column({ nullable: true })
  relevCompteId: string;

  // Status workflow
  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.EN_COURS })
  statut: SettlementStatus;

  @Column({ type: 'timestamp', nullable: true })
  dateCalcul: Date;

  @Column({ type: 'timestamp', nullable: true })
  dateValidation: Date;

  @Column({ nullable: true })
  valideParId: string;

  @Column({ type: 'timestamp', nullable: true })
  dateEnvoi: Date;

  @Column({ type: 'timestamp', nullable: true })
  dateReglement: Date;

  // Approvals
  @Column({ type: 'jsonb', default: [] })
  approbations: Array<{
    niveau: number;
    approbePar: string;
    date: Date;
    commentaire?: string;
  }>;

  // Metadata
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
