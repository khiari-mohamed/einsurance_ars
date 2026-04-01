import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Assure } from '../assures/assures.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { CoCourtier } from '../co-courtiers/co-courtiers.entity';
import { User } from '../users/users.entity';

export enum AffaireStatus {
  DRAFT = 'draft',
  COTATION = 'cotation',
  PREVISION = 'prevision',
  PLACEMENT_REALISE = 'placement_realise',
  ACTIVE = 'active',
  TERMINE = 'termine',
  ANNULE = 'annule',
}

export enum AffaireCategory {
  FACULTATIVE = 'facultative',
  TRAITEE = 'traitee',
}

export enum AffaireType {
  PROPORTIONNEL = 'proportionnel',
  NON_PROPORTIONNEL = 'non_proportionnel',
}

export enum PaymentMode {
  PAYE_HORS_SITUATION = 'paye_hors_situation',
  INCLUS_SITUATION = 'inclus_situation',
}

export enum CommissionCalculMode {
  AUTO = 'auto',
  MANUEL = 'manuel',
}

export enum TreatyType {
  QP = 'qp',
  XOL = 'xol',
  SURPLUS = 'surplus',
  STOP_LOSS = 'stop_loss',
}

export enum PeriodiciteComptes {
  TRIMESTRIEL = 'trimestriel',
  SEMESTRIEL = 'semestriel',
  ANNUEL = 'annuel',
}

export enum PaymentStatus {
  EN_ATTENTE = 'en_attente',
  PARTIEL = 'partiel',
  COMPLET = 'complet',
  RETARDE = 'retarde',
}

export enum SettlementType {
  PAR_AFFAIRE = 'par_affaire',
  PAR_SITUATION = 'par_situation',
}

@Entity('affaires')
export class Affaire {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numeroAffaire: string;

  @Column({ type: 'enum', enum: AffaireStatus, default: AffaireStatus.DRAFT })
  status: AffaireStatus;

  @Column({ type: 'enum', enum: AffaireCategory })
  category: AffaireCategory;

  @Column({ type: 'enum', enum: AffaireType })
  type: AffaireType;

  @ManyToOne(() => Assure, { eager: true })
  @JoinColumn()
  assure: Assure;

  @Column()
  assureId: string;

  @ManyToOne(() => Cedante, { eager: true })
  @JoinColumn()
  cedante: Cedante;

  @Column()
  cedanteId: string;

  @ManyToOne(() => CoCourtier, { nullable: true })
  @JoinColumn()
  coCourtier: CoCourtier;

  @Column({ nullable: true })
  coCourtierId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @Column({ nullable: true })
  numeroPolice: string;

  @Column({ nullable: true })
  branche: string;

  @Column({ nullable: true })
  garantie: string;

  @Column({ type: 'date' })
  dateEffet: Date;

  @Column({ type: 'date' })
  dateEcheance: Date;

  @Column({ type: 'date', nullable: true })
  dateNotification: Date;

  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  capitalAssure100: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  prime100: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxCession: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primeCedee: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxCommissionCedante: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantCommissionCedante: number;

  @Column({ type: 'enum', enum: CommissionCalculMode, default: CommissionCalculMode.AUTO })
  modeCalculCommissionCedante: CommissionCalculMode;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxCommissionARS: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantCommissionARS: number;

  @Column({ type: 'enum', enum: CommissionCalculMode, default: CommissionCalculMode.AUTO })
  modeCalculCommissionARS: CommissionCalculMode;

  @Column({ type: 'enum', enum: PaymentMode, default: PaymentMode.INCLUS_SITUATION })
  paymentMode: PaymentMode;

  @Column({ type: 'int', default: new Date().getFullYear() })
  exercice: number;

  @OneToMany(() => AffaireReassureur, ar => ar.affaire, { cascade: true, eager: true })
  reinsurers: AffaireReassureur[];

  // Facultative: Multiple guarantee lines
  guaranteeLines?: any[]; // Will be loaded separately

  // Treaty: PMD instalments
  pmdInstalments?: any[]; // Will be loaded separately

  // Treaty: Parameters (versioned)
  treatyParameters?: any[]; // Will be loaded separately

  @Column({ type: 'enum', enum: TreatyType, nullable: true })
  treatyType: TreatyType;

  @Column('simple-array', { nullable: true })
  treatyBranches: string[];

  @Column('simple-array', { nullable: true })
  treatyZones: string[];

  @Column({ type: 'enum', enum: PeriodiciteComptes, nullable: true })
  periodiciteComptes: PeriodiciteComptes;

  @Column('simple-array', { nullable: true })
  rubriquesComptes: string[];

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  primePrevisionnelle: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  pmd: number;

  @Column({ default: '70510000' })
  commissionARSAccount: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cedanteAccountCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reassureurAccountCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bordereauReference: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  slipCouvReference: string;

  @Column({ default: false })
  bordereauGenerated: boolean;

  @Column({ default: false })
  slipReceived: boolean;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.EN_ATTENTE })
  paymentStatusCedante: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.EN_ATTENTE })
  paymentStatusReinsurers: PaymentStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primeEncaissee: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primeDecaissee: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sapTotal: number;

  @Column({ type: 'date', nullable: true })
  nextSettlementDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sinistresTotal: number;

  @Column({ default: 0 })
  sinistresCount: number;

  @Column({ type: 'enum', enum: SettlementType, default: SettlementType.PAR_AFFAIRE })
  settlementType: SettlementType;

  // FX rate at booking (taux de réalisation)
  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1 })
  tauxRealisation: number;

  // Document checklist completion
  @Column({ type: 'jsonb', default: {} })
  documentChecklist: {
    noteSynthese?: boolean;
    slipCotation?: boolean;
    ordreAssurance?: boolean;
    slipCouverture?: boolean;
    bordereauCession?: boolean;
    conventionCedante?: boolean;
    conventionReassureur?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('affaire_reassureurs')
export class AffaireReassureur {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Affaire, affaire => affaire.reinsurers, { onDelete: 'CASCADE' })
  @JoinColumn()
  affaire: Affaire;

  @Column()
  affaireId: string;

  @ManyToOne(() => Reassureur, { eager: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column()
  reassureurId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  share: number;

  @Column({ type: 'varchar', length: 20, default: 'FOLLOWER' })
  role: string;

  @Column({ default: false })
  signed: boolean;

  @Column({ default: false })
  slipReceived: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primePart: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionPart: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
