import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreatyParameters } from './treaty-parameters.entity';
import { Affaire } from '../affaires.entity';

export interface CreateTreatyParametersDto {
  affaireId: string;
  anneeRenouvellement: number;
  dateEffet: Date;
  dateEcheance: Date;
  seuilNotificationSinistre?: number;
  seuilCashCall?: number;
  tauxCommissionCedante?: number;
  tauxCommissionARS?: number;
  tauxCommissionLiquidation?: number;
  conditionsParticulieres?: any;
  notes?: string;
}

export interface UpdateTreatyParametersDto {
  seuilNotificationSinistre?: number;
  seuilCashCall?: number;
  tauxCommissionCedante?: number;
  tauxCommissionARS?: number;
  tauxCommissionLiquidation?: number;
  conditionsParticulieres?: any;
  notes?: string;
}

@Injectable()
export class TreatyParametersService {
  constructor(
    @InjectRepository(TreatyParameters)
    private parametersRepository: Repository<TreatyParameters>,
    @InjectRepository(Affaire)
    private affaireRepository: Repository<Affaire>,
  ) {}

  async create(createDto: CreateTreatyParametersDto, userId: string): Promise<TreatyParameters> {
    const affaire = await this.affaireRepository.findOne({ where: { id: createDto.affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${createDto.affaireId} not found`);
    }

    // Deactivate previous parameters
    await this.parametersRepository.update(
      { affaireId: createDto.affaireId, actif: true },
      { actif: false }
    );

    const parameters = this.parametersRepository.create({
      ...createDto,
      createdById: userId,
      actif: true,
      modifications: [],
    });

    return this.parametersRepository.save(parameters);
  }

  async findByAffaire(affaireId: string, activeOnly = true): Promise<TreatyParameters[]> {
    const query = this.parametersRepository
      .createQueryBuilder('params')
      .where('params.affaireId = :affaireId', { affaireId });

    if (activeOnly) {
      query.andWhere('params.actif = :actif', { actif: true });
    }

    return query.orderBy('params.anneeRenouvellement', 'DESC').getMany();
  }

  async findActive(affaireId: string): Promise<TreatyParameters | null> {
    return this.parametersRepository.findOne({
      where: { affaireId, actif: true },
      relations: ['affaire', 'createdBy'],
    });
  }

  async findOne(id: string): Promise<TreatyParameters> {
    const parameters = await this.parametersRepository.findOne({
      where: { id },
      relations: ['affaire', 'createdBy'],
    });

    if (!parameters) {
      throw new NotFoundException(`Treaty parameters ${id} not found`);
    }

    return parameters;
  }

  async update(id: string, updateDto: UpdateTreatyParametersDto, userId: string, motif?: string): Promise<TreatyParameters> {
    const parameters = await this.findOne(id);

    if (!parameters.actif) {
      throw new BadRequestException('Cannot update inactive parameters');
    }

    // Track modifications
    const modifications = [];
    for (const [key, newValue] of Object.entries(updateDto)) {
      const oldValue = parameters[key];
      if (oldValue !== newValue && newValue !== undefined) {
        modifications.push({
          date: new Date(),
          champ: key,
          ancienneValeur: oldValue,
          nouvelleValeur: newValue,
          modifiePar: userId,
          motif,
        });
      }
    }

    Object.assign(parameters, updateDto);
    parameters.modifications = [...parameters.modifications, ...modifications];

    return this.parametersRepository.save(parameters);
  }

  async renewForNextYear(affaireId: string, userId: string, modifications?: Partial<CreateTreatyParametersDto>): Promise<TreatyParameters> {
    const currentParams = await this.findActive(affaireId);
    if (!currentParams) {
      throw new NotFoundException(`No active parameters found for affaire ${affaireId}`);
    }

    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    // Calculate next year dates
    const nextYear = currentParams.anneeRenouvellement + 1;
    const dateEffet = new Date(currentParams.dateEffet);
    dateEffet.setFullYear(dateEffet.getFullYear() + 1);
    const dateEcheance = new Date(currentParams.dateEcheance);
    dateEcheance.setFullYear(dateEcheance.getFullYear() + 1);

    // Deactivate current parameters
    currentParams.actif = false;
    await this.parametersRepository.save(currentParams);

    // Create new parameters for next year
    const newParams = this.parametersRepository.create({
      affaireId,
      anneeRenouvellement: nextYear,
      dateEffet,
      dateEcheance,
      seuilNotificationSinistre: currentParams.seuilNotificationSinistre,
      seuilCashCall: currentParams.seuilCashCall,
      tauxCommissionCedante: currentParams.tauxCommissionCedante,
      tauxCommissionARS: currentParams.tauxCommissionARS,
      tauxCommissionLiquidation: currentParams.tauxCommissionLiquidation,
      conditionsParticulieres: currentParams.conditionsParticulieres,
      notes: `Renewed from ${currentParams.anneeRenouvellement}`,
      ...modifications,
      createdById: userId,
      actif: true,
      modifications: [{
        date: new Date(),
        champ: 'renewal',
        ancienneValeur: currentParams.anneeRenouvellement,
        nouvelleValeur: nextYear,
        modifiePar: userId,
        motif: 'Annual renewal',
      }],
    });

    return this.parametersRepository.save(newParams);
  }

  async deactivate(id: string): Promise<TreatyParameters> {
    const parameters = await this.findOne(id);
    parameters.actif = false;
    return this.parametersRepository.save(parameters);
  }

  async getModificationHistory(affaireId: string): Promise<any[]> {
    const allParams = await this.findByAffaire(affaireId, false);
    
    const history = [];
    for (const params of allParams) {
      for (const mod of params.modifications) {
        history.push({
          ...mod,
          anneeRenouvellement: params.anneeRenouvellement,
          parametersId: params.id,
        });
      }
    }

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
