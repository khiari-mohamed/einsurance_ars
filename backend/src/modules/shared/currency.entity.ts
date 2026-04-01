import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  rateToTND: number;

  @Column({ type: 'date' })
  effectiveDate: Date;

  @Column({ default: 'BCT' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
