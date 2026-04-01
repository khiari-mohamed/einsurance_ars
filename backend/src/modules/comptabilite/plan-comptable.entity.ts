import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AccountType {
  ACTIF = 'actif',
  PASSIF = 'passif',
  CHARGE = 'charge',
  PRODUIT = 'produit',
}

export enum AccountClass {
  CLASSE_1 = '1',
  CLASSE_2 = '2',
  CLASSE_3 = '3',
  CLASSE_4 = '4',
  CLASSE_5 = '5',
  CLASSE_6 = '6',
  CLASSE_7 = '7',
}

@Entity('plan_comptable')
@Index(['code'], { unique: true })
@Index(['classe'])
export class PlanComptable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  libelle: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ type: 'enum', enum: AccountClass })
  classe: AccountClass;

  @Column({ nullable: true })
  parentCode: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isAuxiliary: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
