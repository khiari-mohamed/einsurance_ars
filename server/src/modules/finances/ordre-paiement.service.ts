import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdreVirementStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { PdfService } from '../../shared/services/pdf.service';
import { CreateOrdrePaiementDto } from './dto/create-ordre-paiement.dto';

@Injectable()
export class OrdrePaiementService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private pdf: PdfService,
  ) {}

  async findAll(page = 1, limit = 20, statut?: OrdreVirementStatut) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (statut) where.statut = statut;
    const [data, total] = await Promise.all([
      this.prisma.ordrePaiement.findMany({
        where,
        include: { bankAccount: { include: { reassureur: true } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ordrePaiement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const op = await this.prisma.ordrePaiement.findUnique({
      where: { id },
      include: {
        bankAccount: { include: { reassureur: true } },
        decaissements: true,
        documents: { include: { document: true } },
      },
    });
    if (!op) throw new NotFoundException('Ordre de paiement introuvable');
    return op;
  }

  async create(dto: CreateOrdrePaiementDto) {
    const reference = await this.sequence.next('ORDRE_PAIEMENT');

    // Validate bank account exists (and has SWIFT for foreign currency)
    if (dto.bankAccountId) {
      const bank = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bank) throw new NotFoundException('Compte bancaire bénéficiaire introuvable');
      if ((dto.currency ?? 'TND') !== 'TND' && !bank.swift) {
        throw new BadRequestException('Code SWIFT obligatoire pour les virements en devises étrangères');
      }
    }

    return this.prisma.ordrePaiement.create({
      data: {
        reference,
        statut: OrdreVirementStatut.BROUILLON,
        beneficiaire: dto.beneficiaire,
        bankAccountId: dto.bankAccountId,
        montant: dto.montant,
        currency: dto.currency ?? 'TND',
        referenceAffaire: dto.referenceAffaire,
        referenceBordereau: dto.referenceBordereau,
        dateExecution: dto.dateExecution ? new Date(dto.dateExecution) : undefined,
        signataires: dto.signataires ?? [],
      },
      include: { bankAccount: true },
    });
  }

  async validate(id: string, userId: string) {
    const op = await this.findOne(id);
    if (op.statut !== OrdreVirementStatut.BROUILLON) {
      throw new BadRequestException('Seul un ordre BROUILLON peut être validé');
    }
    return this.prisma.ordrePaiement.update({
      where: { id },
      data: { statut: OrdreVirementStatut.VALIDE },
    });
  }

  async markExecuted(id: string) {
    const op = await this.findOne(id);
    if (op.statut !== OrdreVirementStatut.VALIDE) {
      throw new BadRequestException('L\'ordre doit être VALIDE avant exécution');
    }
    return this.prisma.ordrePaiement.update({
      where: { id },
      data: { statut: OrdreVirementStatut.EXECUTE, dateExecution: new Date() },
    });
  }

  async attachSwift(id: string, swiftDocumentId: string) {
    const op = await this.findOne(id);
    if (op.statut !== OrdreVirementStatut.EXECUTE) {
      throw new BadRequestException('Le SWIFT ne peut être attaché qu\'après exécution');
    }
    return this.prisma.ordrePaiement.update({
      where: { id },
      data: { statut: OrdreVirementStatut.SWIFT_RECU, swiftReceived: true, swiftDocumentId },
    });
  }

  /** Generate PDF from Handlebars template */
  async generatePdf(id: string): Promise<Buffer> {
    const op = await this.findOne(id);
    const company = await this.prisma.companyProfile.findFirst();

    return this.pdf.generateFromTemplate('payment-order', {
      ordre: op,
      company,
      date: new Date().toLocaleDateString('fr-TN'),
    });
  }
}