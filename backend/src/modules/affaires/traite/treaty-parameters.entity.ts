import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Affaire } from '../affaires.entity';
import { User } from '../../users/users.entity';

@Entity('treaty_parameters')
export class TreatyParameters {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Affaire, { onDelete: 'CASCADE' })
  @JoinColumn()
  affaire: Affaire;

  @Index()
  @Column()
  affaireId: string;

  @Column({ type: 'int' })
  anneeRenouvellement: number;

  @Column({ type: 'date' })
  dateEffet: Date;

  @Column({ type: 'date' })
  dateEcheance: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  seuilNotificationSinistre: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  seuilCashCall: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxCommissionCedante: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxCommissionARS: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxCommissionLiquidation: number;

  @Column({ type: 'jsonb', nullable: true })
  conditionsParticulieres: {
    franchise?: number;
    plafond?: number;
    clausesSpeciales?: string[];
    exclusions?: string[];
  };

  @Column({ type: 'jsonb', default: [] })
  modifications: Array<{
    date: Date;
    champ: string;
    ancienneValeur: any;
    nouvelleValeur: any;
    modifiePar: string;
    motif?: string;
  }>;

  @Column({ default: true })
  actif: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

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
