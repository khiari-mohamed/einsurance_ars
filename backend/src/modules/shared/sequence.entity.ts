import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('sequences')
export class Sequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  type: string;

  @Column()
  year: number;

  @Column({ default: 0 })
  current: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
