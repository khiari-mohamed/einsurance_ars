import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Document } from './document.entity';

export enum LinkType {
  PRIMARY = 'primary',
  RELATED = 'related',
  REFERENCE = 'reference',
}

@Entity('ged_document_links')
export class DocumentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn()
  document: Document;

  @Column()
  documentId: string;

  @Column()
  linkedEntityType: string;

  @Column()
  linkedEntityId: string;

  @Column({ type: 'enum', enum: LinkType, default: LinkType.RELATED })
  linkType: LinkType;

  @CreateDateColumn()
  createdAt: Date;
}
