import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sequence } from './sequence.entity';

@Injectable()
export class SequenceService {
  constructor(@InjectRepository(Sequence) private repo: Repository<Sequence>) {}

  async getNext(type: string, year: number = new Date().getFullYear()): Promise<string> {
    const key = `${type}-${year}`;
    let sequence = await this.repo.findOne({ where: { key } });

    if (!sequence) {
      sequence = this.repo.create({ key, type, year, current: 0 });
    }

    sequence.current += 1;
    await this.repo.save(sequence);

    const prefix = type === 'affaire' ? 'AF' : type === 'traite' ? 'TR' : type === 'sinistre' ? 'SIN' : 'DOC';
    return `${prefix}-${year}-${String(sequence.current).padStart(4, '0')}`;
  }
}
