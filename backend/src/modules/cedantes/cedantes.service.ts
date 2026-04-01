import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Cedante } from './cedantes.entity';
import { CedanteContact } from './contact.entity';
import { AuxiliaryAccountService } from '../comptabilite/auxiliary-account.service';

@Injectable()
export class CedantesService {
  constructor(
    @InjectRepository(Cedante) private repo: Repository<Cedante>,
    @InjectRepository(CedanteContact) private contactRepo: Repository<CedanteContact>,
    @Inject(forwardRef(() => AuxiliaryAccountService)) private auxAccountService: AuxiliaryAccountService,
  ) {}

  async create(data: Partial<Cedante>): Promise<Cedante> {
    const existing = await this.repo.findOne({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException(`Cédante with code ${data.code} already exists`);
    }
    const cedante = await this.repo.save(this.repo.create(data));
    
    const auxAccount = await this.auxAccountService.createForCedante(cedante.id, cedante.raisonSociale);
    cedante.codeComptableAuxiliaire = auxAccount.accountNumber;
    await this.repo.save(cedante);
    
    return cedante;
  }

  private async generateCodeComptable(): Promise<string> {
    const lastCedante = await this.repo.findOne({ 
      where: {}, 
      order: { codeComptableAuxiliaire: 'DESC' } 
    });
    if (!lastCedante?.codeComptableAuxiliaire) {
      return '401001';
    }
    const lastNumber = parseInt(lastCedante.codeComptableAuxiliaire.replace('401', ''));
    return `401${String(lastNumber + 1).padStart(3, '0')}`;
  }

  async findAll(search?: string): Promise<Cedante[]> {
    if (search) {
      return this.repo.find({
        where: [
          { raisonSociale: Like(`%${search}%`) },
          { code: Like(`%${search}%`) },
          { email: Like(`%${search}%`) },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<Cedante> {
    return this.repo.findOne({ where: { id }, relations: ['contacts'] });
  }

  async update(id: string, data: Partial<Cedante>): Promise<Cedante> {
    const cedante = await this.repo.findOne({ where: { id } });
    if (!cedante) {
      throw new NotFoundException(`Cédante with ID ${id} not found`);
    }
    if (data.code && data.code !== cedante.code) {
      const existing = await this.repo.findOne({ where: { code: data.code } });
      if (existing) {
        throw new ConflictException(`Cédante with code ${data.code} already exists`);
      }
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Cédante with ID ${id} not found`);
    }
  }

  async getContacts(cedanteId: string): Promise<CedanteContact[]> {
    return this.contactRepo.find({ where: { cedanteId }, order: { principal: 'DESC', createdAt: 'DESC' } });
  }

  async addContact(cedanteId: string, data: Partial<CedanteContact>): Promise<CedanteContact> {
    const cedante = await this.repo.findOne({ where: { id: cedanteId } });
    if (!cedante) {
      throw new NotFoundException(`Cédante with ID ${cedanteId} not found`);
    }
    const contact = this.contactRepo.create({ ...data, cedanteId });
    return this.contactRepo.save(contact);
  }

  async updateContact(contactId: string, data: Partial<CedanteContact>): Promise<CedanteContact> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }
    await this.contactRepo.update(contactId, data);
    return this.contactRepo.findOne({ where: { id: contactId } });
  }

  async removeContact(contactId: string): Promise<void> {
    const result = await this.contactRepo.delete(contactId);
    if (result.affected === 0) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }
  }
}
