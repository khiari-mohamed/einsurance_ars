import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Cedante } from './cedantes.entity';

@Entity('cedante_contacts')
export class CedanteContact {
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

  @ManyToOne(() => Cedante, cedante => cedante.contacts, { onDelete: 'CASCADE' })
  cedante: Cedante;

  @Column()
  cedanteId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
