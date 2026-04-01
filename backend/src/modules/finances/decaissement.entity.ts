import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { CoCourtier } from '../co-courtiers/co-courtiers.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { Settlement } from '../settlements/settlement.entity';
import { User } from '../users/users.entity';
import { ModePaiement } from './encaissement.entity';

export enum BeneficiaireType {
  REASSUREUR = 'reassureur',
  CEDANTE = 'cedante',
  COURTIER = 'courtier',
}

export enum DecaissementStatus {
  BROUILLON = 'brouillon',
  APPROUVE_N1 = 'approuve_n1',
  APPROUVE_N2 = 'approuve_n2',
  ORDONNANCE = 'ordonnance',
  EXECUTE = 'execute',
  COMPTABILISE = 'comptabilise',
  ANNULE = 'annule',
}

export enum SwiftStatus {
  ENVOYE = 'envoye',
  ACCEPTE = 'accepte',
  REJETE = 'rejete',
}

@Entity('decaissements')
export class Decaissement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Index()
  @Column({ type: 'date' })
  dateDecaissement: Date;

  @Column({ type: 'date' })
  dateValeur: Date;

  @Column({ type: 'enum', enum: BeneficiaireType })
  beneficiaireType: BeneficiaireType;

  @ManyToOne(() => Reassureur, { nullable: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Column({ nullable: true })
  reassureurId: string;

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

  @Column({ type: 'jsonb', nullable: true })
  banqueBeneficiaire: {
    nom: string;
    swift: string;
    iban: string;
    adresse: string;
    pays: string;
  };

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ default: 'TND' })
  devise: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1 })
  tauxChange: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantEquivalentTND: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fraisBancaires: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantTotal: number;

  @Column({ type: 'enum', enum: ModePaiement })
  modePaiement: ModePaiement;

  @Column({ nullable: true })
  referenceSwift: string;

  @Column({ type: 'enum', enum: SwiftStatus, nullable: true })
  statutSwift: SwiftStatus;

  @Column({ nullable: true })
  swiftDocumentUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  swiftUploadedAt: Date;

  @Column({ default: false })
  swiftConfirmationReceived: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionARS: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionCedante: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantNetReassureur: number;

  @ManyToOne(() => Affaire, { nullable: true })
  @JoinColumn()
  affaire: Affaire;

  @Index()
  @Column({ nullable: true })
  affaireId: string;

  @Column({ nullable: true })
  sinistreId: string;

  @ManyToOne(() => Bordereau, { nullable: true })
  @JoinColumn()
  bordereau: Bordereau;

  @Column({ nullable: true })
  bordereauId: string;

  @ManyToOne(() => Settlement, { nullable: true })
  @JoinColumn()
  situation: Settlement;

  @Column({ nullable: true })
  situationId: string;

  @Index()
  @Column({ type: 'enum', enum: DecaissementStatus, default: DecaissementStatus.BROUILLON })
  statut: DecaissementStatus;

  @Column({ type: 'jsonb', default: [] })
  approbations: Array<{
    niveau: number;
    approbePar: string;
    date: Date;
    commentaire?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  ordonnancement: {
    numeroOrdrePaiement: string;
    dateOrdonnancement: Date;
    ordonnateur: string;
  };

  @Column({ nullable: true })
  compteBancaireDebite: string;

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
