import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Affaire, AffaireStatus } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';

export enum ProspectStatus {
  NOUVEAU = 'nouveau',
  CONTACTE = 'contacte',
  EN_NEGOCIATION = 'en_negociation',
  CONVERTI = 'converti',
  PERDU = 'perdu',
}

export enum RenewalStatus {
  A_RENOUVELER = 'a_renouveler',
  EN_COURS = 'en_cours',
  RENOUVELE = 'renouvele',
  NON_RENOUVELE = 'non_renouvele',
}

interface Prospect {
  id: string;
  raisonSociale: string;
  type: 'cedante' | 'reassureur';
  status: ProspectStatus;
  contactEmail: string;
  contactTelephone: string;
  potentielPrimes: number;
  dateProchainSuivi: Date;
  assignedTo: string;
  historique: Array<{ date: Date; action: string; user: string }>;
}

interface Renewal {
  id: string;
  affaireId: string;
  affaireNumero: string;
  cedanteId: string;
  dateEcheance: Date;
  primeActuelle: number;
  status: RenewalStatus;
  assignedTo: string;
}

@Injectable()
export class ProspectionService {
  private prospects: Map<string, Prospect> = new Map();
  private renewals: Map<string, Renewal> = new Map();

  constructor(
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Cedante) private cedanteRepo: Repository<Cedante>,
  ) {}

  async createProspect(data: Partial<Prospect>, userId: string): Promise<Prospect> {
    const prospect: Prospect = {
      id: `PROS-${Date.now()}`,
      raisonSociale: data.raisonSociale,
      type: data.type || 'cedante',
      status: ProspectStatus.NOUVEAU,
      contactEmail: data.contactEmail,
      contactTelephone: data.contactTelephone,
      potentielPrimes: data.potentielPrimes || 0,
      dateProchainSuivi: data.dateProchainSuivi || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      assignedTo: userId,
      historique: [{ date: new Date(), action: 'CREATION', user: userId }],
    };

    this.prospects.set(prospect.id, prospect);
    return prospect;
  }

  async updateProspectStatus(prospectId: string, status: ProspectStatus, userId: string): Promise<Prospect> {
    const prospect = this.prospects.get(prospectId);
    if (!prospect) throw new NotFoundException('Prospect not found');

    prospect.status = status;
    prospect.historique.push({ date: new Date(), action: 'STATUS_CHANGE', user: userId });
    return prospect;
  }

  async convertProspectToCedante(prospectId: string, userId: string): Promise<{ prospect: Prospect; cedanteId: string }> {
    const prospect = this.prospects.get(prospectId);
    if (!prospect) throw new NotFoundException('Prospect not found');

    const cedante = await this.cedanteRepo.save({
      code: `CED-${Date.now()}`,
      raisonSociale: prospect.raisonSociale,
      email: prospect.contactEmail,
      telephone: prospect.contactTelephone,
    });

    prospect.status = ProspectStatus.CONVERTI;
    prospect.historique.push({ date: new Date(), action: 'CONVERTED', user: userId });

    return { prospect, cedanteId: cedante.id };
  }

  async createRenewal(affaireId: string, userId: string): Promise<Renewal> {
    const affaire = await this.affaireRepo.findOne({ where: { id: affaireId }, relations: ['cedante'] });
    if (!affaire) throw new NotFoundException('Affaire not found');

    const renewal: Renewal = {
      id: `REN-${Date.now()}`,
      affaireId: affaire.id,
      affaireNumero: affaire.numeroAffaire,
      cedanteId: affaire.cedanteId,
      dateEcheance: affaire.dateEcheance,
      primeActuelle: affaire.primeCedee,
      status: RenewalStatus.A_RENOUVELER,
      assignedTo: userId,
    };

    this.renewals.set(renewal.id, renewal);
    return renewal;
  }

  async getRenewalsDue(days: number = 60): Promise<Renewal[]> {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return Array.from(this.renewals.values())
      .filter(r => r.dateEcheance <= futureDate && r.status === RenewalStatus.A_RENOUVELER)
      .sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
  }

  @Cron('0 0 * * *')
  async autoGenerateRenewals() {
    const threeMonthsFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const expiringAffaires = await this.affaireRepo.find({
      where: { dateEcheance: LessThan(threeMonthsFromNow), status: AffaireStatus.ACTIVE },
    });

    for (const affaire of expiringAffaires) {
      const existing = Array.from(this.renewals.values()).find(r => r.affaireId === affaire.id);
      if (!existing) await this.createRenewal(affaire.id, 'SYSTEM');
    }
  }

  async getProspectionStats(): Promise<any> {
    const prospects = Array.from(this.prospects.values());
    const renewals = Array.from(this.renewals.values());

    return {
      prospects: {
        total: prospects.length,
        nouveau: prospects.filter(p => p.status === ProspectStatus.NOUVEAU).length,
        converti: prospects.filter(p => p.status === ProspectStatus.CONVERTI).length,
        potentielTotal: prospects.reduce((sum, p) => sum + p.potentielPrimes, 0),
      },
      renewals: {
        total: renewals.length,
        aRenouveler: renewals.filter(r => r.status === RenewalStatus.A_RENOUVELER).length,
        primeTotal: renewals.reduce((sum, r) => sum + r.primeActuelle, 0),
      },
    };
  }
}
