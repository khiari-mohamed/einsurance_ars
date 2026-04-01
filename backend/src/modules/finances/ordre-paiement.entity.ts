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
import { Decaissement } from './decaissement.entity';
import { User } from '../users/users.entity';

export enum PaymentOrderStatus {
  BROUILLON = 'brouillon',
  VERIFIE = 'verifie',
  SIGNE = 'signe',
  TRANSMIS = 'transmis',
  ANNULE = 'annule',
}

export enum PaymentOrderTemplate {
  STANDARD = 'standard',
  URGENT = 'urgent',
  INTERNATIONAL = 'international',
}

@Entity('ordres_paiement')
@Index(['numero'], { unique: true })
@Index(['decaissementId'])
@Index(['statut'])
export class OrdrePaiement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ type: 'timestamp' })
  dateCreation: Date;

  // Linked décaissement
  @ManyToOne(() => Decaissement, { eager: true })
  @JoinColumn()
  decaissement: Decaissement;

  @Column()
  decaissementId: string;

  // Beneficiary details
  @Column({ type: 'jsonb' })
  beneficiaire: {
    nom: string;
    banque: string;
    rib?: string;
    iban: string;
    bic?: string;
    adresse: string;
    pays: string;
  };

  // Payment details
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ default: 'TND' })
  devise: string;

  @Column()
  montantLettres: string; // "Dix mille dinars"

  // Purpose
  @Column()
  objet: string;

  @Column({ nullable: true })
  referenceFacture: string;

  @Column({ nullable: true })
  referenceAffaire: string;

  // Signature workflow
  @Column({ nullable: true })
  creeParId: string;

  @Column({ nullable: true })
  verificateurId: string;

  @Column({ type: 'timestamp', nullable: true })
  dateVerification: Date;

  @Column({ nullable: true })
  ordinateurId: string;

  @Column({ type: 'timestamp', nullable: true })
  dateSignature: Date;

  @Column({ type: 'text', nullable: true })
  commentaireSignature: string;

  @Column({ type: 'timestamp', nullable: true })
  dateTransmission: Date;

  @Column({ nullable: true })
  transmisParId: string;

  // Status workflow
  @Column({ type: 'enum', enum: PaymentOrderStatus, default: PaymentOrderStatus.BROUILLON })
  statut: PaymentOrderStatus;

  // PDF generation
  @Column({ type: 'enum', enum: PaymentOrderTemplate, default: PaymentOrderTemplate.STANDARD })
  template: PaymentOrderTemplate;

  @Column({ nullable: true })
  cheminPDF: string; // Path to generated PDF file

  @Column({ type: 'timestamp', nullable: true })
  dateGeneration: Date;

  // Bank transmission
  @Column({ nullable: true })
  referenceBank: string; // Bank's reference after transmission

  @Column({ type: 'timestamp', nullable: true })
  dateConfirmationBank: Date;

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
