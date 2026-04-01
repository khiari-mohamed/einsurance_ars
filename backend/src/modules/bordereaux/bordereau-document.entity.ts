import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Bordereau } from './bordereaux.entity';
import { User } from '../users/users.entity';

export enum BordereauDocumentType {
  BULLETIN_SOIN = 'bulletin_soin',
  FACTURE = 'facture',
  ORDRE_PAIEMENT = 'ordre_paiement',
  RELEVE_BANCAIRE = 'releve_bancaire',
  CORRESPONDANCE = 'correspondance',
  CONTRAT = 'contrat',
  AVIS_SINISTRE = 'avis_sinistre',
  AUTRE = 'autre',
}

@Entity('bordereau_documents')
export class BordereauDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bordereau, { onDelete: 'CASCADE' })
  @JoinColumn()
  bordereau: Bordereau;

  @Column()
  bordereauId: string;

  @Column({ type: 'enum', enum: BordereauDocumentType })
  type: BordereauDocumentType;

  @Column()
  nomFichier: string;

  @Column()
  cheminS3: string;

  @Column({ type: 'int' })
  taille: number;

  @Column()
  mimeType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User)
  @JoinColumn()
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  uploadedAt: Date;
}
