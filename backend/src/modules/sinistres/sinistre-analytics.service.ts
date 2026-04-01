import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sinistre, SinistreStatus } from './sinistres.entity';

@Injectable()
export class SinistreAnalyticsService {
  constructor(
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
  ) {}

  async getEvolution(months: number = 12) {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const sinistres = await this.sinistreRepo.find({
        where: { dateSurvenance: Between(startDate, endDate) },
      });

      result.push({
        period: startDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        count: sinistres.length,
        amount: sinistres.reduce((sum, s) => sum + Number(s.montantTotal), 0),
      });
    }

    return result;
  }

  async getByCedante() {
    const sinistres = await this.sinistreRepo.find({ relations: ['cedante'] });
    const grouped = sinistres.reduce((acc, s) => {
      const key = s.cedante.id;
      if (!acc[key]) {
        acc[key] = {
          cedante: s.cedante.raisonSociale,
          count: 0,
          amount: 0,
        };
      }
      acc[key].count++;
      acc[key].amount += Number(s.montantTotal);
      return acc;
    }, {} as Record<string, any>);

    const result = Object.values(grouped);
    const totalAmount = result.reduce((sum: number, item: any) => sum + item.amount, 0);

    return result.map((item: any) => ({
      ...item,
      ratio: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
    })).sort((a: any, b: any) => b.amount - a.amount);
  }

  async getByStatus() {
    const sinistres = await this.sinistreRepo.find();
    const grouped = sinistres.reduce((acc, s) => {
      if (!acc[s.statut]) {
        acc[s.statut] = { status: s.statut, count: 0, amount: 0 };
      }
      acc[s.statut].count++;
      acc[s.statut].amount += Number(s.montantTotal);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }

  async getAging() {
    const now = new Date();
    const sinistres = await this.sinistreRepo.find({
      where: [
        { statut: SinistreStatus.DECLARE },
        { statut: SinistreStatus.EN_EXPERTISE },
        { statut: SinistreStatus.EN_REGLEMENT },
        { statut: SinistreStatus.PARTIEL },
      ],
    });

    const aging = {
      '0-30 jours': { count: 0, amount: 0 },
      '31-60 jours': { count: 0, amount: 0 },
      '61-90 jours': { count: 0, amount: 0 },
      '+90 jours': { count: 0, amount: 0 },
    };

    sinistres.forEach(s => {
      const days = Math.floor((now.getTime() - new Date(s.dateNotificationARS).getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(s.montantRestant);

      if (days <= 30) {
        aging['0-30 jours'].count++;
        aging['0-30 jours'].amount += amount;
      } else if (days <= 60) {
        aging['31-60 jours'].count++;
        aging['31-60 jours'].amount += amount;
      } else if (days <= 90) {
        aging['61-90 jours'].count++;
        aging['61-90 jours'].amount += amount;
      } else {
        aging['+90 jours'].count++;
        aging['+90 jours'].amount += amount;
      }
    });

    return aging;
  }

  async getSAPAnalysis() {
    const sinistres = await this.sinistreRepo.find();
    const totalReserves = sinistres.reduce((sum, s) => sum + Number(s.sapActuel), 0);
    const totalOutstanding = sinistres.reduce((sum, s) => sum + Number(s.montantRestant), 0);

    return {
      totalReserves,
      totalOutstanding,
      coverageRatio: totalOutstanding > 0 ? (totalReserves / totalOutstanding) * 100 : 0,
      averageReserve: sinistres.length > 0 ? totalReserves / sinistres.length : 0,
    };
  }
}
