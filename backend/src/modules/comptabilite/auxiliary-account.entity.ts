import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { PlanComptable } from './plan-comptable.entity';

export enum EntityType {
  CEDANTE = 'cedante',
  REASSUREUR = 'reassureur',
  CLIENT = 'client',
  COURTIER = 'courtier',
}

@Entity('auxiliary_accounts')
@Index(['entityType', 'entityId'], { unique: true })
export class AuxiliaryAccount {
  @PrimaryColumn()
  accountNumber: string;

  @Column({ type: 'enum', enum: EntityType })
  entityType: EntityType;

  @Column()
  entityId: string;

  @Column()
  entityName: string;

  @Column()
  mainAccountNumber: string;

  @ManyToOne(() => PlanComptable)
  @JoinColumn({ name: 'mainAccountNumber', referencedColumnName: 'code' })
  mainAccount: PlanComptable;

  @CreateDateColumn()
  createdAt: Date;
}
