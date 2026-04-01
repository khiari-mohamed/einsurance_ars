import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { User } from '../users/users.entity';

export enum SinistreStatus {
  DECLARE = 'declare',
  EN_EXPERTISE = 'en_expertise',
  EN_REGLEMENT = 'en_reglement',
  PARTIEL = 'partiel',
  REGLE = 'regle',
  CONTESTE = 'conteste',
  CLOS = 'clos',
}

export enum PaymentStatus {
  EN_ATTENTE = 'en_attente',
  PARTIEL = 'partiel',
  PAYE = 'paye',
  EN_RETARD = 'en_retard',
}

export enum NotificationType {
  INITIAL = 'initial',
  RAPPEL = 'rappel',
  URGENT = 'urgent',
}

export enum NotificationMoyen {
  EMAIL = 'email',
  FAX = 'fax',
  PORTAL = 'portal',
}

export enum NotificationStatut {
  ENVOYE = 'envoye',
  LU = 'lu',
  ERREUR = 'erreur',
}

export enum ExpertiseStatus {
  EN_COURS = 'en_cours',
  TERMINE = 'termine',
  ANNULE = 'annule',
}

export enum AdjustmentType {
  AUGMENTATION = 'augmentation',
  REDUCTION = 'reduction',
  CLOTURE = 'cloture',
}

@Entity('sinistres')
export class Sinistre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column()
  referenceCedante: string;

  @ManyToOne(() => Affaire, { eager: true })
  @JoinColumn()
  affaire: Affaire;

  @Index()
  @Column()
  affaireId: string;

  @ManyToOne(() => Cedante, { eager: true })
  @JoinColumn()
  cedante: Cedante;

  @Index()
  @Column()
  cedanteId: string;

  @Index()
  @Column({ type: 'date' })
  dateSurvenance: Date;

  @Column({ type: 'date' })
  dateDeclarationCedante: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  dateNotificationARS: Date;

  @Column({ type: 'timestamp', nullable: true })
  dateNotificationReassureurs: Date;

  @Column({ type: 'date', nullable: true })
  dateReglement: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantCedantePart: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantReassurance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantRegle: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantRestant: number;

  @Index()
  @Column({ type: 'enum', enum: SinistreStatus, default: SinistreStatus.DECLARE })
  statut: SinistreStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sapInitial: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sapActuel: number;

  @Column({ type: 'timestamp', nullable: true })
  dateDerniereRevisionSAP: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  cause: string;

  @Column({ nullable: true })
  lieu: string;

  @Column({ default: false })
  cedantePaymentVerified: boolean;

  @Column({ default: false })
  expertiseRequise: boolean;

  @OneToMany(() => SinistreParticipation, sp => sp.sinistre, { cascade: true, eager: true })
  participations: SinistreParticipation[];

  @OneToMany(() => SinistreDocument, sd => sd.sinistre, { cascade: true })
  documents: SinistreDocument[];

  @OneToMany(() => Expertise, e => e.sinistre, { cascade: true })
  expertises: Expertise[];

  @OneToMany(() => SAPTracking, sap => sap.sinistre, { cascade: true })
  sapTracking: SAPTracking[];

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sinistre_participations')
export class SinistreParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sinistre, sinistre => sinistre.participations, { onDelete: 'CASCADE' })
  @JoinColumn()
  sinistre: Sinistre;

  @Column()
  sinistreId: string;

  @ManyToOne(() => Reassureur, { eager: true })
  @JoinColumn()
  reassureur: Reassureur;

  @Index()
  @Column()
  reassureurId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  partPourcentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantPart: number;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.EN_ATTENTE })
  statutPaiement: PaymentStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantPaye: number;

  @Column({ type: 'date', nullable: true })
  datePaiement: Date;

  @Column({ nullable: true })
  referencePaiement: string;

  @OneToMany(() => ParticipationNotification, pn => pn.participation, { cascade: true })
  notifications: ParticipationNotification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('participation_notifications')
export class ParticipationNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SinistreParticipation, p => p.notifications, { onDelete: 'CASCADE' })
  @JoinColumn()
  participation: SinistreParticipation;

  @Column()
  participationId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'enum', enum: NotificationMoyen })
  moyen: NotificationMoyen;

  @Column({ type: 'enum', enum: NotificationStatut, default: NotificationStatut.ENVOYE })
  statut: NotificationStatut;

  @Column({ type: 'text', nullable: true })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sinistre_documents')
export class SinistreDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sinistre, s => s.documents, { onDelete: 'CASCADE' })
  @JoinColumn()
  sinistre: Sinistre;

  @Column()
  sinistreId: string;

  @Column()
  type: string;

  @Column()
  nom: string;

  @Column()
  fichierUrl: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User)
  @JoinColumn()
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @CreateDateColumn()
  dateUpload: Date;
}

@Entity('expertises')
export class Expertise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sinistre, s => s.expertises, { onDelete: 'CASCADE' })
  @JoinColumn()
  sinistre: Sinistre;

  @Column()
  sinistreId: string;

  @Column()
  expertNom: string;

  @Column({ nullable: true })
  expertSociete: string;

  @Column({ type: 'date' })
  dateDesignation: Date;

  @Column({ type: 'date', nullable: true })
  dateRapport: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  coutExpertise: number;

  @Column({ nullable: true })
  rapportUrl: string;

  @Column({ type: 'text', nullable: true })
  conclusions: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  montantRecommande: number;

  @Column({ type: 'enum', enum: ExpertiseStatus, default: ExpertiseStatus.EN_COURS })
  statut: ExpertiseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sap_tracking')
export class SAPTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sinistre, s => s.sapTracking, { onDelete: 'CASCADE' })
  @JoinColumn()
  sinistre: Sinistre;

  @Column()
  sinistreId: string;

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'int' })
  mois: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantInitial: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  montantPaye: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montantReserve: number;

  @OneToMany(() => SAPAdjustment, adj => adj.sapTracking, { cascade: true })
  ajustements: SAPAdjustment[];

  @Column({ default: false })
  clotureAnnee: boolean;

  @Column({ type: 'date', nullable: true })
  dateCloture: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gainPerte: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sap_adjustments')
export class SAPAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SAPTracking, sap => sap.ajustements, { onDelete: 'CASCADE' })
  @JoinColumn()
  sapTracking: SAPTracking;

  @Column()
  sapTrackingId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @Column({ type: 'text' })
  raison: string;

  @ManyToOne(() => User)
  @JoinColumn()
  validePar: User;

  @Column()
  valideParId: string;

  @CreateDateColumn()
  createdAt: Date;
}
