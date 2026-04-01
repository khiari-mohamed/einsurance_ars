import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Document } from './document.entity';
import { User } from '../users/users.entity';

@Entity('ged_document_shares')
export class DocumentShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn()
  document: Document;

  @Column()
  documentId: string;

  @Column({ unique: true })
  token: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'int', nullable: true })
  maxDownloads: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: 0 })
  downloadCount: number;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
