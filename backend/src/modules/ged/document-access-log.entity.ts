import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Document } from './document.entity';
import { User } from '../users/users.entity';

export enum AccessAction {
  VIEW = 'view',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  UPDATE = 'update',
  DELETE = 'delete',
  SHARE = 'share',
}

@Entity('ged_document_access_logs')
export class DocumentAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn()
  document: Document;

  @Column()
  documentId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: AccessAction })
  action: AccessAction;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  timestamp: Date;
}
