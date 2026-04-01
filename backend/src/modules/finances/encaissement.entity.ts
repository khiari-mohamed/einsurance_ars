import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';
import { Assure } from '../assures/assures.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { CoCourtier } from '../co-courtiers/co-courtiers.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { User } from '../users/users.entity';

export enum SourceType {
  CEDANTE = 'cedante',
  CLIENT = 'client',
  REASSUREUR = 'reassureur',
  COURTIER = 'courtier',
}

export enum ModePaiement {
  VIREMENT = 'virement',
  CHEQUE = 'cheque',
  EFFET = 'effet',
  CASH = 'cash',
  SWIFT = 'swift',
}

export enum EncaissementStatus {
  BROUILLON = 'brouillon',
  SAISI = 'saisi',
  VALIDE = 'valide',
  COMPTABILISE = 'comptabilise',
  ANNULE = 'annule',
}

@Entity('encaissements')
export class Encaissement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Index()
  @Column({ type: 'date' })
  dateEncaissement: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1 })
  tauxChange: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantEquivalentTND: number;

  @Column({ type: 'enum', enum: SourceType })
  sourceType: SourceType;

  @ManyToOne(() => Cedante, { nullable: true })
  @JoinColumn()
  cedante: Cedante;

  @Column({ nullable: true })
  cedanteId: string;

  @ManyToOne(() => Assure, { nullable: true })
  @JoinColumn()
  client: Assure;

  @Column({ nullable: true })
  clientId: string;

  @ManyToOne(() => Reassureur, { nullable: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ nullable: true })
  reassureurId: string;

  @ManyToOne(() => CoCourtier, { nullable: true })
  @JoinColumn()
  courtier: CoCourtier;

  @Column({ nullable: true })
  courtierId: string;

  @Column({ type: 'enum', enum: ModePaiement })
  modePaiement: ModePaiement;

  @Column({ unique: true })
  referencePaiement: string;

  @Column({ nullable: true })
  banqueEmettrice: string;

  @ManyToOne(() => Bordereau, { nullable: true })
  @JoinColumn()
  bordereau: Bordereau;

  @Column({ nullable: true })
  bordereauId: string;

  @ManyToOne(() => Affaire, { nullable: true })
  @JoinColumn()
  affaire: Affaire;

  @Index()
  @Column({ nullable: true })
  affaireId: string;

  @Index()
  @Column({ type: 'enum', enum: EncaissementStatus, default: EncaissementStatus.BROUILLON })
  statut: EncaissementStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  validePar: User;

  @Column({ nullable: true })
  valideParId: string;

  @Column({ type: 'timestamp', nullable: true })
  dateValidation: Date;

  @Column({ nullable: true })
  compteBancaireId: string;

  @Column({ default: 'VTE' })
  codeJournal: string;

  @Column({ nullable: true })
  pieceComptable: string;

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
