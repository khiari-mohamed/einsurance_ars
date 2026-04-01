import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/users.entity';

export enum LettrageStatus {
  AUTO = 'auto',
  MANUEL = 'manuel',
  PARTIEL = 'partiel',
  COMPLET = 'complet',
}

export enum LettrageType {
  AFFAIRE = 'affaire',
  CEDANTE = 'cedante',
  REASSUREUR = 'reassureur',
  CLIENT = 'client',
}

@Entity('lettrages')
export class Lettrage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column({ type: 'date' })
  dateLettrage: Date;

  @Column({ type: 'jsonb', default: [] })
  encaissements: Array<{
    encaissementId: string;
    montantAffecte: number;
  }>;

  @Column({ type: 'jsonb', default: [] })
  decaissements: Array<{
    decaissementId: string;
    montantAffecte: number;
  }>;

  @Column({ type: 'jsonb', default: [] })
  creances: Array<{
    bordereauId: string;
    montantDu: number;
    montantRegle: number;
  }>;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  soldeAvant: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  soldeApres: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  ecart: number;

  @Column({ type: 'enum', enum: LettrageStatus })
  statut: LettrageStatus;

  @Column({ type: 'enum', enum: LettrageType })
  type: LettrageType;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
