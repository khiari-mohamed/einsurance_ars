import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VALIDATE = 'VALIDATE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  COMPTABILIZE = 'COMPTABILIZE',
  EXECUTE = 'EXECUTE',
  RECONCILE = 'RECONCILE',
}

export enum AuditEntityType {
  ENCAISSEMENT = 'ENCAISSEMENT',
  DECAISSEMENT = 'DECAISSEMENT',
  SETTLEMENT = 'SETTLEMENT',
  COMMISSION = 'COMMISSION',
  ORDRE_PAIEMENT = 'ORDRE_PAIEMENT',
  ACCOUNTING_ENTRY = 'ACCOUNTING_ENTRY',
  EXCHANGE_RATE = 'EXCHANGE_RATE',
  LETTRAGE = 'LETTRAGE',
}

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['createdAt', 'actionType'])
@Index(['userId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditActionType })
  actionType: AuditActionType;

  @Column({ type: 'enum', enum: AuditEntityType })
  entityType: AuditEntityType;

  @Column()
  entityId: string;

  // User information
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  userEmail: string;

  @Column({ nullable: true })
  userRole: string;

  // Request details
  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  // Before/After values
  @Column({ type: 'jsonb', nullable: true })
  beforeValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  afterValues: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  changedFields: string[]; // List of field names that changed

  // Details
  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  // Metadata
  @Column({ type: 'text', nullable: true })
  referenceDocuments: string; // comma-separated document IDs

  @Column({ default: 'NORMAL' })
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Compliance
  @Column({ default: false })
  requiresReview: boolean;

  @Column({ nullable: true })
  reviewedById: string;

  @Column({ type: 'timestamp', nullable: true })
  dateReview: Date;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  // Retention
  @Column({ type: 'date', nullable: true })
  dateRetention: Date; // When audit log should be archived
}
