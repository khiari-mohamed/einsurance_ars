import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuxiliaryAccount, EntityType } from './auxiliary-account.entity';

@Injectable()
export class AuxiliaryAccountService {
  constructor(
    @InjectRepository(AuxiliaryAccount) private auxRepo: Repository<AuxiliaryAccount>,
  ) {}

  async createForCedante(cedanteId: string, cedanteName: string): Promise<AuxiliaryAccount> {
    const accountNumber = await this.generateAccountNumber('411');
    return this.auxRepo.save(this.auxRepo.create({
      accountNumber,
      entityType: EntityType.CEDANTE,
      entityId: cedanteId,
      entityName: cedanteName,
      mainAccountNumber: '41100000',
    }));
  }

  async createForReassureur(reassureurId: string, reassureurName: string): Promise<AuxiliaryAccount> {
    const accountNumber = await this.generateAccountNumber('401');
    return this.auxRepo.save(this.auxRepo.create({
      accountNumber,
      entityType: EntityType.REASSUREUR,
      entityId: reassureurId,
      entityName: reassureurName,
      mainAccountNumber: '40100000',
    }));
  }

  async createForClient(clientId: string, clientName: string): Promise<AuxiliaryAccount> {
    const accountNumber = await this.generateAccountNumber('411');
    return this.auxRepo.save(this.auxRepo.create({
      accountNumber,
      entityType: EntityType.CLIENT,
      entityId: clientId,
      entityName: clientName,
      mainAccountNumber: '41100000',
    }));
  }

  async createForCourtier(courtierId: string, courtierName: string): Promise<AuxiliaryAccount> {
    const accountNumber = await this.generateAccountNumber('401');
    return this.auxRepo.save(this.auxRepo.create({
      accountNumber,
      entityType: EntityType.COURTIER,
      entityId: courtierId,
      entityName: courtierName,
      mainAccountNumber: '40100000',
    }));
  }

  async findByEntity(entityType: EntityType, entityId: string): Promise<AuxiliaryAccount> {
    return this.auxRepo.findOne({ where: { entityType, entityId } });
  }

  async findAll(): Promise<AuxiliaryAccount[]> {
    return this.auxRepo.find({ order: { accountNumber: 'ASC' } });
  }

  private async generateAccountNumber(prefix: string): Promise<string> {
    const count = await this.auxRepo.count({ where: { mainAccountNumber: `${prefix}00000` } });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }
}
