import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Traite } from './traites.entity';

@Injectable()
export class TraitesService {
  constructor(@InjectRepository(Traite) private repo: Repository<Traite>) {}

  create(data: Partial<Traite>): Promise<Traite> {
    return this.repo.save(this.repo.create(data));
  }

  findAll(): Promise<Traite[]> {
    return this.repo.find({ relations: ['cedante'], order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<Traite> {
    return this.repo.findOne({ where: { id }, relations: ['cedante'] });
  }

  async update(id: string, data: Partial<Traite>): Promise<Traite> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
