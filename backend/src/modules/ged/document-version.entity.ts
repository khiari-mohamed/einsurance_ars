import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Document } from './document.entity';
import { User } from '../users/users.entity';

@Entity('ged_document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn()
  document: Document;

  @Column()
  documentId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column()
  storagePath: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ nullable: true })
  checksum: string;

  @Column({ type: 'text', nullable: true })
  changeDescription: string;

  @ManyToOne(() => User)
  @JoinColumn()
  changedBy: User;

  @Column()
  changedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
