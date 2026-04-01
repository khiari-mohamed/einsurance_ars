import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  ADMINISTRATEUR = 'ADMINISTRATEUR',
  DIRECTEUR_GENERAL = 'DIRECTEUR_GENERAL',
  DIRECTEUR_COMMERCIAL = 'DIRECTEUR_COMMERCIAL',
  DIRECTEUR_FINANCIER = 'DIRECTEUR_FINANCIER',
  CHARGE_DE_DOSSIER = 'CHARGE_DE_DOSSIER',
  RESPONSABLE_PRODUCTION = 'RESPONSABLE_PRODUCTION',
  TECHNICIEN_SINISTRES = 'TECHNICIEN_SINISTRES',
  AGENT_FINANCIER = 'AGENT_FINANCIER',
  COMPTABLE = 'COMPTABLE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CHARGE_DE_DOSSIER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  resetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
