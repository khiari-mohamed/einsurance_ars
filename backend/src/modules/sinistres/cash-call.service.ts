import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashCall, CashCallStatus } from './cash-call.entity';
import { CreateCashCallDto, UpdateCashCallDto, AddCommunicationDto, AddSuiviDto } from './dto/cash-call.dto';

@Injectable()
export class CashCallService {
  constructor(
    @InjectRepository(CashCall)
    private cashCallRepository: Repository<CashCall>,
  ) {}

  async create(createDto: CreateCashCallDto, userId: string): Promise<CashCall> {
    const numero = await this.generateNumero();
    
    const cashCall = this.cashCallRepository.create({
      ...createDto,
      numero,
      dateEmission: new Date(),
      createdById: userId,
      suivis: [{
        date: new Date(),
        action: 'Cash call initiated',
        user: userId,
      }],
    });

    return this.cashCallRepository.save(cashCall);
  }

  async findAll(filters?: any): Promise<CashCall[]> {
    const query = this.cashCallRepository.createQueryBuilder('cashCall')
      .leftJoinAndSelect('cashCall.sinistre', 'sinistre')
      .leftJoinAndSelect('cashCall.reassureur', 'reassureur');

    if (filters?.sinistreId) {
      query.andWhere('cashCall.sinistreId = :sinistreId', { sinistreId: filters.sinistreId });
    }

    if (filters?.reassureurId) {
      query.andWhere('cashCall.reassureurId = :reassureurId', { reassureurId: filters.reassureurId });
    }

    if (filters?.statut) {
      query.andWhere('cashCall.statut = :statut', { statut: filters.statut });
    }

    return query.orderBy('cashCall.dateEmission', 'DESC').getMany();
  }

  async findOne(id: string): Promise<CashCall> {
    const cashCall = await this.cashCallRepository.findOne({
      where: { id },
      relations: ['sinistre', 'reassureur', 'createdBy'],
    });

    if (!cashCall) {
      throw new NotFoundException(`Cash call ${id} not found`);
    }

    return cashCall;
  }

  async update(id: string, updateDto: UpdateCashCallDto, userId: string): Promise<CashCall> {
    const cashCall = await this.findOne(id);

    Object.assign(cashCall, updateDto);

    cashCall.suivis.push({
      date: new Date(),
      action: 'Cash call updated',
      user: userId,
      notes: JSON.stringify(updateDto),
    });

    return this.cashCallRepository.save(cashCall);
  }

  async addCommunication(id: string, dto: AddCommunicationDto, userId: string): Promise<CashCall> {
    const cashCall = await this.findOne(id);

    cashCall.communications.push({
      date: new Date(),
      type: dto.type,
      message: dto.message,
      sentBy: userId,
      response: dto.response,
    });

    cashCall.suivis.push({
      date: new Date(),
      action: `Communication sent via ${dto.type}`,
      user: userId,
    });

    return this.cashCallRepository.save(cashCall);
  }

  async addSuivi(id: string, dto: AddSuiviDto, userId: string): Promise<CashCall> {
    const cashCall = await this.findOne(id);

    cashCall.suivis.push({
      date: new Date(),
      action: dto.action,
      user: userId,
      notes: dto.notes,
    });

    return this.cashCallRepository.save(cashCall);
  }

  async sendReminder(id: string, userId: string): Promise<CashCall> {
    const cashCall = await this.findOne(id);

    if (cashCall.statut === CashCallStatus.PAID) {
      throw new BadRequestException('Cannot send reminder for paid cash call');
    }

    cashCall.rappelEnvoye = true;
    cashCall.nombreRappels += 1;
    cashCall.dateDernierRappel = new Date();

    cashCall.suivis.push({
      date: new Date(),
      action: `Reminder sent (${cashCall.nombreRappels})`,
      user: userId,
    });

    return this.cashCallRepository.save(cashCall);
  }

  async markAsPaid(id: string, montantRecu: number, referencePaiement: string, userId: string): Promise<CashCall> {
    const cashCall = await this.findOne(id);

    cashCall.montantRecu = montantRecu;
    cashCall.referencePaiement = referencePaiement;
    cashCall.datePaiement = new Date();
    
    if (montantRecu >= cashCall.montantDemande) {
      cashCall.statut = CashCallStatus.PAID;
    } else {
      cashCall.statut = CashCallStatus.PARTIAL;
    }

    cashCall.suivis.push({
      date: new Date(),
      action: `Payment received: ${montantRecu} ${cashCall.devise}`,
      user: userId,
      notes: `Reference: ${referencePaiement}`,
    });

    return this.cashCallRepository.save(cashCall);
  }

  async checkOverdue(): Promise<CashCall[]> {
    const today = new Date();
    
    const overdueCalls = await this.cashCallRepository
      .createQueryBuilder('cashCall')
      .where('cashCall.dateEcheance < :today', { today })
      .andWhere('cashCall.statut NOT IN (:...statuses)', { 
        statuses: [CashCallStatus.PAID, CashCallStatus.CANCELLED] 
      })
      .getMany();

    for (const call of overdueCalls) {
      call.statut = CashCallStatus.OVERDUE;
      await this.cashCallRepository.save(call);
    }

    return overdueCalls;
  }

  private async generateNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.cashCallRepository.count();
    return `CC-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
