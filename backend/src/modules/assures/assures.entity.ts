import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AssureContact } from './contact.entity';

@Entity('assures')
export class Assure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  raisonSociale: string;

  @Column({ nullable: true })
  formeJuridique: string;

  @Column({ nullable: true })
  adresse: string;

  @Column({ nullable: true })
  ville: string;

  @Column({ nullable: true })
  codePostal: string;

  @Column({ nullable: true })
  pays: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  matriculeFiscale: string;

  @Column({ nullable: true })
  rib: string;

  @Column({ nullable: true })
  banque: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ unique: true, nullable: true })
  codeComptable: string;

  @OneToMany(() => AssureContact, contact => contact.assure, { cascade: true })
  contacts: AssureContact[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
