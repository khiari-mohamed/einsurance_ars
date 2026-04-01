import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sinistre } from './sinistres.entity';
import { SinistrePDFService } from './sinistre-pdf.service';

interface BordereauSinistreData {
  startDate: Date;
  endDate: Date;
  reassureurId?: string;
  cedanteId?: string;
}

@Injectable()
export class SinistreBordereauService {
  constructor(
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    private pdfService: SinistrePDFService,
  ) {}

  async generateBordereauSinistres(data: BordereauSinistreData) {
    const where: any = {
      dateSurvenance: Between(data.startDate, data.endDate),
    };

    if (data.cedanteId) where.cedanteId = data.cedanteId;

    let sinistres = await this.sinistreRepo.find({
      where,
      relations: ['cedante', 'affaire', 'participations', 'participations.reassureur'],
      order: { dateSurvenance: 'ASC' },
    });

    if (data.reassureurId) {
      sinistres = sinistres.filter(s =>
        s.participations.some(p => p.reassureurId === data.reassureurId)
      );
    }

    const bordereauData = {
      numero: this.generateBordereauNumber(),
      dateEmission: new Date(),
      periode: {
        debut: data.startDate,
        fin: data.endDate,
      },
      sinistres: sinistres.map(s => ({
        numero: s.numero,
        referenceCedante: s.referenceCedante,
        cedante: s.cedante.raisonSociale,
        affaire: s.affaire.numeroAffaire,
        dateSurvenance: s.dateSurvenance,
        dateDeclaration: s.dateDeclarationCedante,
        montantTotal: s.montantTotal,
        montantCedante: s.montantCedantePart,
        montantReassurance: s.montantReassurance,
        montantRegle: s.montantRegle,
        montantRestant: s.montantRestant,
        sapActuel: s.sapActuel,
        statut: s.statut,
        participations: data.reassureurId
          ? s.participations.filter(p => p.reassureurId === data.reassureurId)
          : s.participations,
      })),
      totaux: {
        nombreSinistres: sinistres.length,
        montantTotal: sinistres.reduce((sum, s) => sum + Number(s.montantTotal), 0),
        montantReassurance: sinistres.reduce((sum, s) => sum + Number(s.montantReassurance), 0),
        montantRegle: sinistres.reduce((sum, s) => sum + Number(s.montantRegle), 0),
        montantRestant: sinistres.reduce((sum, s) => sum + Number(s.montantRestant), 0),
        sapTotal: sinistres.reduce((sum, s) => sum + Number(s.sapActuel), 0),
      },
    };

    return bordereauData;
  }

  async generateBordereauWithPDF(data: BordereauSinistreData) {
    const bordereauData = await this.generateBordereauSinistres(data);
    const pdfUrl = await this.pdfService.generateBordereauPDF(bordereauData);
    
    return {
      ...bordereauData,
      pdfUrl,
    };
  }

  private generateBordereauNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BDS-${year}${month}-${random}`;
  }
}
