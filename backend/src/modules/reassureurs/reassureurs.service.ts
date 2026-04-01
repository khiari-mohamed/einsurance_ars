import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reassureur } from './reassureurs.entity';
import { AuxiliaryAccountService } from '../comptabilite/auxiliary-account.service';

@Injectable()
export class ReassureursService {
  constructor(
    @InjectRepository(Reassureur) private repo: Repository<Reassureur>,
    @Inject(forwardRef(() => AuxiliaryAccountService)) private auxAccountService: AuxiliaryAccountService,
  ) {}

  async create(data: Partial<Reassureur>): Promise<Reassureur> {
    const reassureur = await this.repo.save(this.repo.create(data));
    
    const auxAccount = await this.auxAccountService.createForReassureur(reassureur.id, reassureur.raisonSociale);
    reassureur.codeComptableAuxiliaire = auxAccount.accountNumber;
    await this.repo.save(reassureur);
    
    return reassureur;
  }

  findAll(): Promise<Reassureur[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<Reassureur> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Reassureur>): Promise<Reassureur> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
