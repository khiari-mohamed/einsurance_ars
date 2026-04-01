import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Assure } from './assures.entity';
import { AssureContact } from './contact.entity';

@Injectable()
export class AssuresService {
  constructor(
    @InjectRepository(Assure) private repo: Repository<Assure>,
    @InjectRepository(AssureContact) private contactRepo: Repository<AssureContact>
  ) {}

  async create(data: Partial<Assure>): Promise<Assure> {
    const existing = await this.repo.findOne({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException(`Assuré with code ${data.code} already exists`);
    }
    if (!data.codeComptable) {
      data.codeComptable = await this.generateCodeComptable();
    }
    return this.repo.save(this.repo.create(data));
  }

  private async generateCodeComptable(): Promise<string> {
    const lastAssure = await this.repo.findOne({ 
      where: {}, 
      order: { codeComptable: 'DESC' } 
    });
    if (!lastAssure?.codeComptable) {
      return '411001';
    }
    const lastNumber = parseInt(lastAssure.codeComptable.replace('411', ''));
    return `411${String(lastNumber + 1).padStart(3, '0')}`;
  }

  async findAll(search?: string): Promise<Assure[]> {
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

  findOne(id: string): Promise<Assure> {
    return this.repo.findOne({ where: { id }, relations: ['contacts'] });
  }

  async update(id: string, data: Partial<Assure>): Promise<Assure> {
    const assure = await this.repo.findOne({ where: { id } });
    if (!assure) {
      throw new NotFoundException(`Assuré with ID ${id} not found`);
    }
    if (data.code && data.code !== assure.code) {
      const existing = await this.repo.findOne({ where: { code: data.code } });
      if (existing) {
        throw new ConflictException(`Assuré with code ${data.code} already exists`);
      }
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Assuré with ID ${id} not found`);
    }
  }

  async getContacts(assureId: string): Promise<AssureContact[]> {
    return this.contactRepo.find({ where: { assureId }, order: { principal: 'DESC', createdAt: 'DESC' } });
  }

  async addContact(assureId: string, data: Partial<AssureContact>): Promise<AssureContact> {
    const assure = await this.repo.findOne({ where: { id: assureId } });
    if (!assure) {
      throw new NotFoundException(`Assuré with ID ${assureId} not found`);
    }
    const contact = this.contactRepo.create({ ...data, assureId });
    return this.contactRepo.save(contact);
  }

  async updateContact(contactId: string, data: Partial<AssureContact>): Promise<AssureContact> {
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
