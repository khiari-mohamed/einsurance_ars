import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PMDInstalment, InstalmentStatus } from './pmd-instalment.entity';
import { Affaire } from '../affaires.entity';

export interface CreatePMDInstalmentDto {
  affaireId: string;
  numeroEcheance: number;
  dateEcheance: Date;
  montant: number;
  pourcentage: number;
  notes?: string;
}

export interface UpdatePMDInstalmentDto {
  montantPaye?: number;
  datePaiement?: Date;
  referencePaiement?: string;
  notes?: string;
}

@Injectable()
export class PMDInstalmentService {
  constructor(
    @InjectRepository(PMDInstalment)
    private instalmentRepository: Repository<PMDInstalment>,
    @InjectRepository(Affaire)
    private affaireRepository: Repository<Affaire>,
  ) {}

  async createSchedule(affaireId: string, pmdTotal: number, instalments: Array<{ percentage: number; daysFromStart: number }>): Promise<PMDInstalment[]> {
    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const startDate = new Date(affaire.dateEffet);
    const created: PMDInstalment[] = [];

    for (let i = 0; i < instalments.length; i++) {
      const { percentage, daysFromStart } = instalments[i];
      const dateEcheance = new Date(startDate);
      dateEcheance.setDate(dateEcheance.getDate() + daysFromStart);

      const instalment = this.instalmentRepository.create({
        affaireId,
        numeroEcheance: i + 1,
        dateEcheance,
        montant: (pmdTotal * percentage) / 100,
        pourcentage: percentage,
        statut: InstalmentStatus.PENDING,
      });

      created.push(await this.instalmentRepository.save(instalment));
    }

    return created;
  }

  async findByAffaire(affaireId: string): Promise<PMDInstalment[]> {
    return this.instalmentRepository.find({
      where: { affaireId },
      order: { numeroEcheance: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PMDInstalment> {
    const instalment = await this.instalmentRepository.findOne({
      where: { id },
      relations: ['affaire'],
    });

    if (!instalment) {
      throw new NotFoundException(`Instalment ${id} not found`);
    }

    return instalment;
  }

  async update(id: string, updateDto: UpdatePMDInstalmentDto): Promise<PMDInstalment> {
    const instalment = await this.findOne(id);

    Object.assign(instalment, updateDto);

    return this.instalmentRepository.save(instalment);
  }

  async markAsPaid(id: string, montantPaye: number, referencePaiement: string, datePaiement: Date): Promise<PMDInstalment> {
    const instalment = await this.findOne(id);

    instalment.montantPaye = montantPaye;
    instalment.referencePaiement = referencePaiement;
    instalment.datePaiement = datePaiement;

    if (montantPaye >= instalment.montant) {
      instalment.statut = InstalmentStatus.PAID;
    } else if (montantPaye > 0) {
      instalment.statut = InstalmentStatus.PARTIAL;
    }

    return this.instalmentRepository.save(instalment);
  }

  async sendReminder(id: string): Promise<PMDInstalment> {
    const instalment = await this.findOne(id);

    if (instalment.statut === InstalmentStatus.PAID) {
      throw new BadRequestException('Cannot send reminder for paid instalment');
    }

    instalment.rappelEnvoye = true;
    instalment.dateRappel = new Date();

    return this.instalmentRepository.save(instalment);
  }

  async checkOverdue(): Promise<PMDInstalment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await this.instalmentRepository
      .createQueryBuilder('instalment')
      .where('instalment.dateEcheance < :today', { today })
      .andWhere('instalment.statut IN (:...statuses)', {
        statuses: [InstalmentStatus.PENDING, InstalmentStatus.DUE, InstalmentStatus.PARTIAL],
      })
      .getMany();

    for (const instalment of overdue) {
      instalment.statut = InstalmentStatus.OVERDUE;
      await this.instalmentRepository.save(instalment);
    }

    return overdue;
  }

  async checkDue(): Promise<PMDInstalment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7); // 7 days before due

    const due = await this.instalmentRepository
      .createQueryBuilder('instalment')
      .where('instalment.dateEcheance BETWEEN :today AND :dueDate', { today, dueDate })
      .andWhere('instalment.statut = :status', { status: InstalmentStatus.PENDING })
      .getMany();

    for (const instalment of due) {
      instalment.statut = InstalmentStatus.DUE;
      await this.instalmentRepository.save(instalment);
    }

    return due;
  }

  async delete(id: string): Promise<void> {
    const instalment = await this.findOne(id);
    
    if (instalment.statut === InstalmentStatus.PAID) {
      throw new BadRequestException('Cannot delete paid instalment');
    }

    await this.instalmentRepository.remove(instalment);
  }
}
