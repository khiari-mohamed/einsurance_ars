import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('company_parameters')
export class CompanyParameters {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ default: 'TND' })
  defaultCurrency: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: any;

  @UpdateDateColumn()
  updatedAt: Date;
}
