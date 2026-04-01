import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Affaire, AffaireStatus, AffaireReassureur } from './affaires.entity';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(AffaireReassureur) private reinsurerRepo: Repository<AffaireReassureur>,
  ) {}

  async sendToCotation(affaireId: string): Promise<Affaire> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['reinsurers', 'reinsurers.reassureur'],
    });

    if (!affaire) throw new BadRequestException('Affaire not found');
    if (affaire.status !== AffaireStatus.DRAFT) {
      throw new BadRequestException('Affaire must be in DRAFT status');
    }
    if (!affaire.reinsurers || affaire.reinsurers.length === 0) {
      throw new BadRequestException('Add at least one reinsurer before sending to cotation');
    }

    await this.affaireRepo.update(affaireId, { status: AffaireStatus.COTATION });
    return this.affaireRepo.findOne({ where: { id: affaireId }, relations: ['reinsurers', 'reinsurers.reassureur'] });
  }

  async receiveSlip(affaireId: string, slipReference: string, signedReinsurers: string[]): Promise<Affaire> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['reinsurers'],
    });

    if (!affaire) throw new BadRequestException('Affaire not found');
    if (affaire.status !== AffaireStatus.PLACEMENT_REALISE) {
      throw new BadRequestException('Affaire must be in PLACEMENT_REALISE status');
    }

    const updateData: any = {
      slipCouvReference: slipReference,
      slipReceived: true,
    };

    if (affaire.category === 'traitee' && affaire.periodiciteComptes) {
      updateData.nextSettlementDate = this.calculateNextSettlementDate(new Date(), affaire.periodiciteComptes);
    }

    await this.affaireRepo.update(affaireId, updateData);

    if (signedReinsurers && signedReinsurers.length > 0) {
      for (const reassureurId of signedReinsurers) {
        await this.reinsurerRepo.update(
          { affaireId, reassureurId },
          { signed: true, slipReceived: true }
        );
      }
    }

    return this.affaireRepo.findOne({ where: { id: affaireId }, relations: ['reinsurers', 'reinsurers.reassureur'] });
  }

  private calculateNextSettlementDate(fromDate: Date, periodicite: string): Date {
    const date = new Date(fromDate);
    switch (periodicite) {
      case 'trimestriel': date.setMonth(date.getMonth() + 3); break;
      case 'semestriel': date.setMonth(date.getMonth() + 6); break;
      case 'annuel': date.setFullYear(date.getFullYear() + 1); break;
    }
    return date;
  }

  async generateBordereauCedante(affaireId: string): Promise<any> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['cedante', 'assure', 'reinsurers', 'reinsurers.reassureur'],
    });

    if (!affaire) throw new BadRequestException('Affaire not found');

    const bordereauReference = `BORD-CED-${affaire.numeroAffaire}-${Date.now()}`;

    const bordereau = {
      reference: bordereauReference,
      type: 'CEDANTE',
      date: new Date(),
      affaireId: affaire.id,
      cedanteId: affaire.cedanteId,
      cedante: {
        code: affaire.cedante.code,
        raisonSociale: affaire.cedante.raisonSociale,
      },
      assure: {
        code: affaire.assure.code,
        raisonSociale: affaire.assure.raisonSociale,
      },
      data: {
        numeroAffaire: affaire.numeroAffaire,
        numeroPolice: affaire.numeroPolice,
        branche: affaire.branche,
        dateEffet: affaire.dateEffet,
        dateEcheance: affaire.dateEcheance,
        devise: affaire.devise,
        capitalAssure100: affaire.capitalAssure100,
        prime100: affaire.prime100,
        tauxCession: affaire.tauxCession,
        primeCedee: affaire.primeCedee,
        commissionCedante: affaire.montantCommissionCedante,
        tauxCommissionCedante: affaire.tauxCommissionCedante,
        commissionARS: affaire.montantCommissionARS,
        tauxCommissionARS: affaire.tauxCommissionARS,
        netPrime: affaire.primeCedee - affaire.montantCommissionARS,
        reinsurers: affaire.reinsurers.map(r => ({
          code: r.reassureur.code,
          raisonSociale: r.reassureur.raisonSociale,
          share: r.share,
          primePart: r.primePart,
          commissionPart: r.commissionPart,
          netAmount: r.netAmount,
        })),
      },
    };

    await this.affaireRepo.update(affaireId, {
      bordereauReference,
      bordereauGenerated: true,
    });

    return bordereau;
  }

  async generateBordereauReassureur(affaireId: string, reassureurId: string): Promise<any> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['cedante', 'assure', 'reinsurers', 'reinsurers.reassureur'],
    });

    if (!affaire) throw new BadRequestException('Affaire not found');

    const reinsurer = affaire.reinsurers.find(r => r.reassureurId === reassureurId);
    if (!reinsurer) throw new BadRequestException('Reinsurer not found in this affaire');

    const bordereauReference = `BORD-REAS-${affaire.numeroAffaire}-${reinsurer.reassureur.code}-${Date.now()}`;

    return {
      reference: bordereauReference,
      type: 'REASSUREUR',
      date: new Date(),
      affaireId: affaire.id,
      reassureurId: reinsurer.reassureurId,
      reassureur: {
        code: reinsurer.reassureur.code,
        raisonSociale: reinsurer.reassureur.raisonSociale,
      },
      data: {
        numeroAffaire: affaire.numeroAffaire,
        numeroPolice: affaire.numeroPolice,
        branche: affaire.branche,
        dateEffet: affaire.dateEffet,
        dateEcheance: affaire.dateEcheance,
        devise: affaire.devise,
        primeCedee: affaire.primeCedee,
        share: reinsurer.share,
        primePart: reinsurer.primePart,
        commissionPart: reinsurer.commissionPart,
        netAmount: reinsurer.netAmount,
      },
    };
  }

  async generateAccountingEntries(affaireId: string): Promise<any[]> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['cedante', 'reinsurers', 'reinsurers.reassureur'],
    });

    if (!affaire) throw new BadRequestException('Affaire not found');

    const entries = [
      {
        date: new Date(),
        compteDebit: affaire.cedanteAccountCode || '41100000',
        compteCredit: affaire.commissionARSAccount,
        montant: affaire.montantCommissionARS,
        libelle: `Commission ARS - ${affaire.numeroAffaire}`,
        affaireId: affaire.id,
        type: 'COMMISSION_ARS',
      },
      {
        date: new Date(),
        compteDebit: '40100000',
        compteCredit: affaire.cedanteAccountCode || '41100000',
        montant: affaire.primeCedee - affaire.montantCommissionARS,
        libelle: `Prime nette réassureurs - ${affaire.numeroAffaire}`,
        affaireId: affaire.id,
        type: 'PRIME_NETTE',
      },
    ];

    for (const reinsurer of affaire.reinsurers) {
      entries.push({
        date: new Date(),
        compteDebit: reinsurer.reassureur.codeComptableAuxiliaire || '40100000',
        compteCredit: '40100000',
        montant: reinsurer.netAmount,
        libelle: `Part ${reinsurer.reassureur.raisonSociale} - ${affaire.numeroAffaire}`,
        affaireId: affaire.id,
        type: 'PART_REASSUREUR',
      } as any);
    }

    return entries;
  }
}
