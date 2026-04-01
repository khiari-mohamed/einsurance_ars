import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Assure } from './assures.entity';

@Entity('assure_contacts')
export class AssureContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column({ nullable: true })
  fonction: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'boolean', default: true })
  principal: boolean;

  @ManyToOne(() => Assure, assure => assure.contacts, { onDelete: 'CASCADE' })
  assure: Assure;

  @Column()
  assureId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
