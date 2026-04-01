import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Affaire } from '../affaires.entity';

@Entity('guarantee_lines')
export class GuaranteeLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Affaire, { onDelete: 'CASCADE' })
  @JoinColumn()
  affaire: Affaire;

  @Column()
  affaireId: string;

  @Column()
  garantie: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  capitalAssure100: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  prime100: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxPrime: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxCession: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  primeCedee: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: {
    franchise?: number;
    plafond?: number;
    exclusions?: string[];
  };

  @Column({ type: 'int', default: 1 })
  ordre: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
