import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuaranteeLine } from './guarantee-line.entity';
import { Affaire } from '../affaires.entity';

export interface CreateGuaranteeLineDto {
  affaireId: string;
  garantie: string;
  capitalAssure100: number;
  prime100?: number;
  tauxPrime?: number;
  tauxCession?: number;
  description?: string;
  conditions?: any;
  ordre?: number;
}

export interface UpdateGuaranteeLineDto {
  garantie?: string;
  capitalAssure100?: number;
  prime100?: number;
  tauxPrime?: number;
  tauxCession?: number;
  description?: string;
  conditions?: any;
  ordre?: number;
}

@Injectable()
export class GuaranteeLineService {
  constructor(
    @InjectRepository(GuaranteeLine)
    private guaranteeLineRepository: Repository<GuaranteeLine>,
    @InjectRepository(Affaire)
    private affaireRepository: Repository<Affaire>,
  ) {}

  async create(createDto: CreateGuaranteeLineDto): Promise<GuaranteeLine> {
    const affaire = await this.affaireRepository.findOne({ where: { id: createDto.affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${createDto.affaireId} not found`);
    }

    if (affaire.category !== 'facultative') {
      throw new BadRequestException('Guarantee lines are only for facultative deals');
    }

    // Auto-calculate if not provided
    const prime100 = createDto.prime100 || (createDto.capitalAssure100 * (createDto.tauxPrime || 0)) / 100;
    const tauxCession = createDto.tauxCession || affaire.tauxCession;
    const primeCedee = (prime100 * tauxCession) / 100;

    // Get next order number if not provided
    let ordre = createDto.ordre;
    if (!ordre) {
      const maxOrdre = await this.guaranteeLineRepository
        .createQueryBuilder('line')
        .where('line.affaireId = :affaireId', { affaireId: createDto.affaireId })
        .select('MAX(line.ordre)', 'max')
        .getRawOne();
      ordre = (maxOrdre?.max || 0) + 1;
    }

    const guaranteeLine = this.guaranteeLineRepository.create({
      ...createDto,
      prime100,
      tauxCession,
      primeCedee,
      ordre,
    });

    const saved = await this.guaranteeLineRepository.save(guaranteeLine);

    // Update affaire totals
    await this.updateAffaireTotals(createDto.affaireId);

    return saved;
  }

  async findByAffaire(affaireId: string): Promise<GuaranteeLine[]> {
    return this.guaranteeLineRepository.find({
      where: { affaireId },
      order: { ordre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<GuaranteeLine> {
    const line = await this.guaranteeLineRepository.findOne({
      where: { id },
      relations: ['affaire'],
    });

    if (!line) {
      throw new NotFoundException(`Guarantee line ${id} not found`);
    }

    return line;
  }

  async update(id: string, updateDto: UpdateGuaranteeLineDto): Promise<GuaranteeLine> {
    const line = await this.findOne(id);

    // Recalculate if relevant fields changed
    if (updateDto.capitalAssure100 !== undefined || updateDto.tauxPrime !== undefined) {
      const capitalAssure100 = updateDto.capitalAssure100 ?? line.capitalAssure100;
      const tauxPrime = updateDto.tauxPrime ?? line.tauxPrime;
      updateDto.prime100 = (capitalAssure100 * tauxPrime) / 100;
    }

    if (updateDto.prime100 !== undefined || updateDto.tauxCession !== undefined) {
      const prime100 = updateDto.prime100 ?? line.prime100;
      const tauxCession = updateDto.tauxCession ?? line.tauxCession;
      updateDto['primeCedee'] = (prime100 * tauxCession) / 100;
    }

    Object.assign(line, updateDto);
    const saved = await this.guaranteeLineRepository.save(line);

    // Update affaire totals
    await this.updateAffaireTotals(line.affaireId);

    return saved;
  }

  async delete(id: string): Promise<void> {
    const line = await this.findOne(id);
    const affaireId = line.affaireId;
    
    await this.guaranteeLineRepository.remove(line);

    // Update affaire totals
    await this.updateAffaireTotals(affaireId);
  }

  async reorder(affaireId: string, lineIds: string[]): Promise<GuaranteeLine[]> {
    const lines = await this.findByAffaire(affaireId);

    for (let i = 0; i < lineIds.length; i++) {
      const line = lines.find(l => l.id === lineIds[i]);
      if (line) {
        line.ordre = i + 1;
        await this.guaranteeLineRepository.save(line);
      }
    }

    return this.findByAffaire(affaireId);
  }

  private async updateAffaireTotals(affaireId: string): Promise<void> {
    const lines = await this.findByAffaire(affaireId);

    const totalCapital = lines.reduce((sum, line) => sum + Number(line.capitalAssure100), 0);
    const totalPrime = lines.reduce((sum, line) => sum + Number(line.prime100), 0);
    const totalPrimeCedee = lines.reduce((sum, line) => sum + Number(line.primeCedee), 0);

    await this.affaireRepository.update(affaireId, {
      capitalAssure100: totalCapital,
      prime100: totalPrime,
      primeCedee: totalPrimeCedee,
    });
  }

  async getTotals(affaireId: string): Promise<{
    totalCapital: number;
    totalPrime: number;
    totalPrimeCedee: number;
    lineCount: number;
  }> {
    const lines = await this.findByAffaire(affaireId);

    return {
      totalCapital: lines.reduce((sum, line) => sum + Number(line.capitalAssure100), 0),
      totalPrime: lines.reduce((sum, line) => sum + Number(line.prime100), 0),
      totalPrimeCedee: lines.reduce((sum, line) => sum + Number(line.primeCedee), 0),
      lineCount: lines.length,
    };
  }
}
