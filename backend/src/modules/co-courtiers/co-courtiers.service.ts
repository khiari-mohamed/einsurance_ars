import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoCourtier } from './co-courtiers.entity';

@Injectable()
export class CoCourtiersService {
  constructor(@InjectRepository(CoCourtier) private repo: Repository<CoCourtier>) {}

  create(data: Partial<CoCourtier>): Promise<CoCourtier> {
    return this.repo.save(this.repo.create(data));
  }

  findAll(): Promise<CoCourtier[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<CoCourtier> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<CoCourtier>): Promise<CoCourtier> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
