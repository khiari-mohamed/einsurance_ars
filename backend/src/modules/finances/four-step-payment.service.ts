import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encaissement } from './encaissement.entity';
import { Decaissement } from './decaissement.entity';
import { Affaire } from '../affaires/affaires.entity';

export interface FourStepPaymentDto {
  affaireId: string;
  step1: {
    montant: number;
    dateEncaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step2: {
    montant: number;
    dateDecaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step3: {
    montant: number;
    dateEncaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step4: {
    payments: Array<{
      reassureurId: string;
      montant: number;
      dateDecaissement: Date;
      referencePaiement: string;
      modePaiement: string;
    }>;
  };
}

@Injectable()
export class FourStepPaymentService {
  constructor(
    @InjectRepository(Encaissement)
    private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(Affaire)
    private affaireRepo: Repository<Affaire>,
  ) {}

  async executeStep1(affaireId: string, data: any, userId: string): Promise<Encaissement> {
    const affaire = await this.affaireRepo.findOne({ 
      where: { id: affaireId },
      relations: ['assure', 'cedante']
    });
    
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const numero = await this.generateEncaissementNumero();

    const encaissement = this.encaissementRepo.create({
      numero,
      dateEncaissement: data.dateEncaissement,
      montant: data.montant,
      devise: affaire.devise,
      tauxChange: affaire.tauxRealisation || 1,
      montantEquivalentTND: data.montant * (affaire.tauxRealisation || 1),
      sourceType: 'client' as any,
      clientId: affaire.assureId,
      affaireId,
      modePaiement: data.modePaiement as any,
      referencePaiement: data.referencePaiement,
      statut: 'valide' as any,
      notes: 'Step 1: Receipt from insured (100% gross premium)',
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'Step 1 - Receipt from insured',
        user: userId,
        details: `Amount: ${data.montant} ${affaire.devise}`,
      }],
    });

    return this.encaissementRepo.save(encaissement);
  }

  async executeStep2(affaireId: string, data: any, userId: string): Promise<Decaissement> {
    const affaire = await this.affaireRepo.findOne({ 
      where: { id: affaireId },
      relations: ['cedante']
    });
    
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const numero = await this.generateDecaissementNumero();

    const decaissement = this.decaissementRepo.create({
      numero,
      dateDecaissement: data.dateDecaissement,
      dateValeur: data.dateDecaissement,
      beneficiaireType: 'cedante' as any,
      cedanteId: affaire.cedanteId,
      montant: data.montant,
      devise: affaire.devise,
      tauxChange: affaire.tauxRealisation || 1,
      montantEquivalentTND: data.montant * (affaire.tauxRealisation || 1),
      fraisBancaires: 0,
      montantTotal: data.montant,
      montantNetReassureur: data.montant,
      affaireId,
      modePaiement: data.modePaiement as any,
      statut: 'execute' as any,
      notes: 'Step 2: Payment to cedant (100% gross premium)',
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'Step 2 - Payment to cedant',
        user: userId,
        details: `Amount: ${data.montant} ${affaire.devise}`,
      }],
    });

    return this.decaissementRepo.save(decaissement);
  }

  async executeStep3(affaireId: string, data: any, userId: string): Promise<Encaissement> {
    const affaire = await this.affaireRepo.findOne({ 
      where: { id: affaireId },
      relations: ['cedante']
    });
    
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const numero = await this.generateEncaissementNumero();

    const encaissement = this.encaissementRepo.create({
      numero,
      dateEncaissement: data.dateEncaissement,
      montant: data.montant,
      devise: affaire.devise,
      tauxChange: affaire.tauxRealisation || 1,
      montantEquivalentTND: data.montant * (affaire.tauxRealisation || 1),
      sourceType: 'cedante' as any,
      cedanteId: affaire.cedanteId,
      affaireId,
      modePaiement: data.modePaiement as any,
      referencePaiement: data.referencePaiement,
      statut: 'valide' as any,
      notes: 'Step 3: Receipt from cedant (net premium after cedant commission)',
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'Step 3 - Receipt from cedant',
        user: userId,
        details: `Amount: ${data.montant} ${affaire.devise}`,
      }],
    });

    return this.encaissementRepo.save(encaissement);
  }

  async executeStep4(affaireId: string, data: any, userId: string): Promise<Decaissement[]> {
    const affaire = await this.affaireRepo.findOne({ 
      where: { id: affaireId },
      relations: ['reinsurers', 'reinsurers.reassureur']
    });
    
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const decaissements: Decaissement[] = [];

    for (const payment of data.payments) {
      const numero = await this.generateDecaissementNumero();

      const decaissement = this.decaissementRepo.create({
        numero,
        dateDecaissement: payment.dateDecaissement,
        dateValeur: payment.dateDecaissement,
        beneficiaireType: 'reassureur' as any,
        reassureurId: payment.reassureurId,
        montant: payment.montant,
        devise: affaire.devise,
        tauxChange: affaire.tauxRealisation || 1,
        montantEquivalentTND: payment.montant * (affaire.tauxRealisation || 1),
        fraisBancaires: 0,
        montantTotal: payment.montant,
        montantNetReassureur: payment.montant,
        affaireId,
        modePaiement: payment.modePaiement as any,
        statut: 'execute' as any,
        notes: 'Step 4: Payment to reinsurer (net share after ARS commission)',
        createdById: userId,
        historique: [{
          date: new Date(),
          action: 'Step 4 - Payment to reinsurer',
          user: userId,
          details: `Amount: ${payment.montant} ${affaire.devise}`,
        }],
      });

      decaissements.push(await this.decaissementRepo.save(decaissement));
    }

    return decaissements;
  }

  async executeFourStepFlow(dto: FourStepPaymentDto, userId: string): Promise<any> {
    const results = {
      step1: null,
      step2: null,
      step3: null,
      step4: [],
    };

    try {
      // Step 1: Receipt from insured
      results.step1 = await this.executeStep1(dto.affaireId, dto.step1, userId);

      // Step 2: Payment to cedant
      results.step2 = await this.executeStep2(dto.affaireId, dto.step2, userId);

      // Step 3: Receipt from cedant
      results.step3 = await this.executeStep3(dto.affaireId, dto.step3, userId);

      // Step 4: Payments to reinsurers
      results.step4 = await this.executeStep4(dto.affaireId, dto.step4, userId);

      return {
        success: true,
        message: 'Four-step payment flow completed successfully',
        results,
      };
    } catch (error) {
      throw new BadRequestException(`Four-step flow failed: ${error.message}`);
    }
  }

  private async generateEncaissementNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.encaissementRepo.count();
    return `ENC-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateDecaissementNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.decaissementRepo.count();
    return `DEC-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
