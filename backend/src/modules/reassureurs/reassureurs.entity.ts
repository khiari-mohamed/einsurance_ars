import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('reassureurs')
export class Reassureur {
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
  swift: string;

  @Column({ nullable: true })
  iban: string;

  @Column({ nullable: true })
  banque: string;

  @Column({ nullable: true })
  codeComptableAuxiliaire: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
