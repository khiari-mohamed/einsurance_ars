import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement } from './settlement.entity';

@Injectable()
export class SettlementsService {
  constructor(@InjectRepository(Settlement) private repo: Repository<Settlement>) {}

  create(data: Partial<Settlement>): Promise<Settlement> {
    return this.repo.save(this.repo.create(data));
  }

  findAll(): Promise<Settlement[]> {
    return this.repo.find({ relations: ['cedante', 'reassureur'], order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<Settlement> {
    return this.repo.findOne({ where: { id }, relations: ['cedante', 'reassureur'] });
  }
}
