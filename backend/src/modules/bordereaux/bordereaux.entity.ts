import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { User } from '../users/users.entity';
import { BordereauLigne } from './bordereau-line.entity';

export enum BordereauType {
  CESSION = 'cession',
  REASSUREUR = 'reassureur',
  SINISTRE = 'sinistre',
  SITUATION = 'situation',
}

export enum BordereauStatus {
  BROUILLON = 'brouillon',
  EN_VALIDATION = 'en_validation',
  VALIDE = 'valide',
  ENVOYE = 'envoye',
  COMPTABILISE = 'comptabilise',
  ARCHIVE = 'archive',
}

@Entity('bordereaux')
// @Index(['type', 'status'])
// @Index(['dateDebut', 'dateFin'])
export class Bordereau {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ type: 'enum', enum: BordereauType })
  type: BordereauType;

  @Index()
  @Column({ type: 'enum', enum: BordereauStatus, default: BordereauStatus.BROUILLON })
  status: BordereauStatus;

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

  @Column({ type: 'date' })
  dateDebut: Date;

  @Column({ type: 'date' })
  dateFin: Date;

  @Column({ type: 'date' })
  dateEmission: Date;

  @Column({ type: 'date', nullable: true })
  dateLimitePaiement: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primeTotale: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionCedante: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissionARS: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sinistres: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  acompteRecu: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  solde: number;

  @Column({ default: 'TND' })
  devise: string;

  @OneToMany(() => BordereauLigne, ligne => ligne.bordereau, { cascade: true, eager: true })
  lignes: BordereauLigne[];

  @Column({ nullable: true })
  pdfPath: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: [] })
  documents: Array<{
    type: string;
    nomFichier: string;
    cheminS3: string;
    uploadedAt: Date;
  }>;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  validatedBy: User;

  @Column({ nullable: true })
  validatedById: string;

  @Column({ type: 'timestamp', nullable: true })
  dateValidation: Date;

  @Column({ type: 'timestamp', nullable: true })
  dateEnvoi: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
