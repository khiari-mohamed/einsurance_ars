import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/users.entity';

export enum EntityType {
  CLIENT = 'client',
  CEDANTE = 'cedante',
  REASSUREUR = 'reassureur',
  CO_COURTIER = 'co_courtier',
  AFFAIRE = 'affaire',
  SINISTRE = 'sinistre',
  FINANCE = 'finance',
  ACCOUNTING = 'accounting',
}

export enum DocumentType {
  ID_CARD = 'id_card',
  COMPANY_REGISTRATION = 'company_registration',
  INSURANCE_POLICY = 'insurance_policy',
  CORRESPONDENCE = 'correspondence',
  LEGAL_DOCUMENT = 'legal_document',
  BANKING_INFO = 'banking_info',
  POWER_OF_ATTORNEY = 'power_of_attorney',
  TREATY_AGREEMENT = 'treaty_agreement',
  NOTE_SYNTHESE = 'note_synthese',
  DEMANDE_COTATION = 'demande_cotation',
  SLIP_COTATION = 'slip_cotation',
  ORDRE_PLACEMENT = 'ordre_placement',
  SLIP_COUVERTURE = 'slip_couverture',
  BORDEREAU_CESSION = 'bordereau_cession',
  BORDEREAU_REASSUREUR = 'bordereau_reassureur',
  BORDEREAU_SINISTRE = 'bordereau_sinistre',
  AVIS_SINISTRE = 'avis_sinistre',
  EXPERT_REPORT = 'expert_report',
  CLAIM_ASSESSMENT = 'claim_assessment',
  PAYMENT_JUSTIFICATION = 'payment_justification',
  PAYMENT_ORDER = 'payment_order',
  SWIFT_CONFIRMATION = 'swift_confirmation',
  BANK_STATEMENT = 'bank_statement',
  COMMISSION_CALCULATION = 'commission_calculation',
  SETTLEMENT_STATEMENT = 'settlement_statement',
  ACCOUNTING_ENTRY = 'accounting_entry',
  AUDIT_DOCUMENT = 'audit_document',
  CADRE_CONTRACTUEL = 'cadre_contractuel',
  PLACEMENT_PLAN = 'placement_plan',
  TECHNICAL_QUESTIONNAIRE = 'technical_questionnaire',
  REINSURER_RESPONSE = 'reinsurer_response',
  COMMISSION_AGREEMENT = 'commission_agreement',
  SAP_DOCUMENT = 'sap_document',
  PMD_DOCUMENT = 'pmd_document',
  SITUATION_STATEMENT = 'situation_statement',
  OTHER = 'other',
}

export enum ConfidentialityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

@Entity('ged_documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileName: string;

  @Column()
  storagePath: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'enum', enum: EntityType })
  entityType: EntityType;

  @Column()
  entityId: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ type: 'enum', enum: ConfidentialityLevel, default: ConfidentialityLevel.INTERNAL })
  confidentialityLevel: ConfidentialityLevel;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'date', nullable: true })
  validFrom: Date;

  @Column({ type: 'date', nullable: true })
  validTo: Date;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ nullable: true })
  checksum: string;

  @Column({ type: 'text', nullable: true })
  ocrText: string;

  @Column({ nullable: true })
  affaireStage: string;

  @Column({ nullable: true })
  referenceNumber: string;

  @Column({ type: 'boolean', default: false })
  isMandatory: boolean;

  @Column({ nullable: true })
  originalFileName: string;

  @ManyToOne(() => User)
  @JoinColumn()
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
