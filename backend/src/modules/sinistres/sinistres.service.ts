import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, EntityManager } from 'typeorm';
import { Sinistre, SinistreParticipation, SinistreStatus, PaymentStatus, Expertise, SAPTracking, SAPAdjustment, AdjustmentType } from './sinistres.entity';
import { CreateSinistreDto } from './dto/create-sinistre.dto';
import { UpdateSinistreDto } from './dto/update-sinistre.dto';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { CreateExpertiseDto } from './dto/create-expertise.dto';
import { AdjustSAPDto } from './dto/adjust-sap.dto';
import { Affaire } from '../affaires/affaires.entity';
import { SinistreNotificationService } from './sinistre-notification.service';

@Injectable()
export class SinistresService {
  constructor(
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    @InjectRepository(SinistreParticipation) private participationRepo: Repository<SinistreParticipation>,
    @InjectRepository(Expertise) private expertiseRepo: Repository<Expertise>,
    @InjectRepository(SAPTracking) private sapRepo: Repository<SAPTracking>,
    @InjectRepository(SAPAdjustment) private adjustmentRepo: Repository<SAPAdjustment>,
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectEntityManager() private entityManager: EntityManager,
    private notificationService: SinistreNotificationService,
  ) {}

  setAuditService(auditService: any) {
    this.auditService = auditService;
  }

  setFinanceService(financeService: any) {
    this.financeService = financeService;
  }

  private auditService: any;
  private financeService: any;

  async create(dto: CreateSinistreDto, userId: string): Promise<Sinistre> {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const affaire = await transactionalEntityManager.findOne(Affaire, { where: { id: dto.affaireId }, relations: ['reinsurers'] });
      if (!affaire) throw new NotFoundException('Affaire not found');

      const montantReassurance = dto.montantTotal - dto.montantCedantePart;
      const montantRestant = montantReassurance;

      const totalPart = dto.participations.reduce((sum, p) => sum + p.partPourcentage, 0);
      if (Math.abs(totalPart - 100) > 0.01) {
        throw new BadRequestException('Total participation must equal 100%');
      }

      const numero = await this.generateNumero();
      const sapInitial = montantReassurance * 0.5;

      const sinistre = this.sinistreRepo.create({
        numero,
        referenceCedante: dto.referenceCedante,
        affaireId: dto.affaireId,
        cedanteId: dto.cedanteId,
        dateSurvenance: dto.dateSurvenance,
        dateDeclarationCedante: dto.dateDeclarationCedante,
        montantTotal: dto.montantTotal,
        montantCedantePart: dto.montantCedantePart,
        montantReassurance,
        montantRegle: 0,
        montantRestant,
        sapInitial,
        sapActuel: sapInitial,
        description: dto.description,
        cause: dto.cause,
        lieu: dto.lieu,
        cedantePaymentVerified: dto.cedantePaymentVerified || false,
        expertiseRequise: dto.expertiseRequise || false,
        statut: SinistreStatus.DECLARE,
        createdById: userId,
        participations: dto.participations.map(p => this.participationRepo.create({
          reassureurId: p.reassureurId,
          partPourcentage: p.partPourcentage,
          montantPart: montantReassurance * (p.partPourcentage / 100),
          statutPaiement: PaymentStatus.EN_ATTENTE,
          montantPaye: 0,
        })),
      });

      const saved = await transactionalEntityManager.save(sinistre);

      await transactionalEntityManager.update(Affaire, dto.affaireId, {
        sinistresTotal: () => `sinistresTotal + ${dto.montantTotal}`,
        sinistresCount: () => 'sinistresCount + 1',
        sapTotal: () => `sapTotal + ${sapInitial}`,
      });

      const now = new Date();
      await transactionalEntityManager.save(this.sapRepo.create({
        sinistreId: saved.id,
        annee: now.getFullYear(),
        mois: now.getMonth() + 1,
        montantInitial: sapInitial,
        montantPaye: 0,
        montantReserve: sapInitial,
      }));

      return this.findOne(saved.id);
    });
  }

  async findAll(filters?: any): Promise<Sinistre[]> {
    const where: any = {};
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.cedanteId) where.cedanteId = filters.cedanteId;
    if (filters?.affaireId) where.affaireId = filters.affaireId;

    return this.sinistreRepo.find({
      where,
      relations: ['affaire', 'cedante', 'participations', 'participations.reassureur'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Sinistre> {
    const sinistre = await this.sinistreRepo.findOne({
      where: { id },
      relations: ['affaire', 'cedante', 'participations', 'participations.reassureur', 'documents', 'expertises', 'sapTracking'],
    });
    if (!sinistre) throw new NotFoundException('Sinistre not found');
    return sinistre;
  }

  async update(id: string, dto: UpdateSinistreDto, userId?: string): Promise<Sinistre> {
    const before = await this.findOne(id);
    Object.assign(before, dto);
    const after = await this.sinistreRepo.save(before);
    
    if (this.auditService && userId) {
      await this.auditService.log({
        entityType: 'SINISTRE',
        entityId: id,
        action: 'UPDATE',
        userId,
        before,
        after,
      });
    }
    
    return this.findOne(id);
  }

  async updateParticipation(participationId: string, dto: UpdateParticipationDto, userId?: string): Promise<SinistreParticipation> {
    const participation = await this.participationRepo.findOne({ where: { id: participationId }, relations: ['sinistre', 'reassureur'] });
    if (!participation) throw new NotFoundException('Participation not found');

    const wasNotPaid = participation.statutPaiement !== PaymentStatus.PAYE;
    const nowPaid = dto.statutPaiement === PaymentStatus.PAYE;

    Object.assign(participation, dto);
    await this.participationRepo.save(participation);

    if (wasNotPaid && nowPaid && this.financeService) {
      try {
        await this.financeService.createDecaissement({
          type: 'SINISTRE_PAYMENT',
          sinistreId: participation.sinistreId,
          reassureurId: participation.reassureurId,
          montant: participation.montantPaye,
          devise: 'TND',
          reference: dto.referencePaiement || `SIN-PAY-${participation.sinistreId}`,
          dateDecaissement: dto.datePaiement || new Date(),
          statut: 'COMPTABILISE',
        });
      } catch (error) {
        console.error('Failed to create decaissement:', error);
      }
    }

    await this.recalculateSinistreAmounts(participation.sinistreId);
    return participation;
  }

  async notifyReinsurers(id: string): Promise<void> {
    const sinistre = await this.findOne(id);
    if (sinistre.dateNotificationReassureurs) {
      throw new BadRequestException('Reinsurers already notified');
    }

    if (!sinistre.cedantePaymentVerified) {
      throw new BadRequestException('Cédante payment must be verified before notifying reinsurers');
    }

    await this.notificationService.notifyReinsurers(id);

    await this.sinistreRepo.update(id, {
      statut: SinistreStatus.EN_REGLEMENT,
    });
  }

  async createExpertise(dto: CreateExpertiseDto): Promise<Expertise> {
    const sinistre = await this.findOne(dto.sinistreId);
    const expertise = this.expertiseRepo.create(dto);
    await this.expertiseRepo.save(expertise);
    await this.sinistreRepo.update(dto.sinistreId, { statut: SinistreStatus.EN_EXPERTISE });
    return expertise;
  }

  async adjustSAP(dto: AdjustSAPDto, userId: string): Promise<SAPTracking> {
    const sinistre = await this.findOne(dto.sinistreId);
    const now = new Date();
    const currentSAP = await this.sapRepo.findOne({
      where: { sinistreId: dto.sinistreId, annee: now.getFullYear(), mois: now.getMonth() + 1 },
      relations: ['ajustements'],
    });

    if (!currentSAP) throw new NotFoundException('SAP tracking not found');

    let newReserve = currentSAP.montantReserve;
    if (dto.type === AdjustmentType.AUGMENTATION) newReserve += dto.montant;
    else if (dto.type === AdjustmentType.REDUCTION) newReserve -= dto.montant;
    else if (dto.type === AdjustmentType.CLOTURE) newReserve = 0;

    const minReserve = sinistre.montantReassurance * 0.3;
    if (dto.type === AdjustmentType.REDUCTION && newReserve < minReserve) {
      throw new BadRequestException(`Reserve cannot go below 30% of reinsured amount (${minReserve.toFixed(2)})`);
    }

    if (newReserve < 0) {
      throw new BadRequestException('Reserve cannot be negative');
    }

    const adjustment = this.adjustmentRepo.create({
      sapTrackingId: currentSAP.id,
      type: dto.type,
      montant: dto.montant,
      raison: dto.raison,
      valideParId: userId,
    });

    await this.adjustmentRepo.save(adjustment);

    currentSAP.montantReserve = newReserve;
    await this.sapRepo.save(currentSAP);

    await this.sinistreRepo.update(dto.sinistreId, {
      sapActuel: newReserve,
      dateDerniereRevisionSAP: new Date(),
    });

    return this.sapRepo.findOne({ where: { id: currentSAP.id }, relations: ['ajustements'] });
  }

  async getDashboardStats(): Promise<any> {
    const total = await this.sinistreRepo.count();
    const ouverts = await this.sinistreRepo.count({ where: { statut: SinistreStatus.DECLARE } });
    const enRetard = await this.sinistreRepo.count({
      where: { dateNotificationReassureurs: null, createdAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)) },
    });

    const sapTotal = await this.sinistreRepo
      .createQueryBuilder('s')
      .select('SUM(s.sapActuel)', 'total')
      .getRawOne();

    return { total, ouverts, enRetard, sapTotal: parseFloat(sapTotal?.total || 0) };
  }

  private async recalculateSinistreAmounts(sinistreId: string): Promise<void> {
    const participations = await this.participationRepo.find({ where: { sinistreId } });
    const montantRegle = participations.reduce((sum, p) => sum + p.montantPaye, 0);
    const sinistre = await this.findOne(sinistreId);
    const montantRestant = sinistre.montantReassurance - montantRegle;

    const allPaid = participations.every(p => p.statutPaiement === PaymentStatus.PAYE);
    const statut = allPaid ? SinistreStatus.REGLE : montantRegle > 0 ? SinistreStatus.PARTIEL : sinistre.statut;

    await this.sinistreRepo.update(sinistreId, { montantRegle, montantRestant, statut });
  }

  private async generateNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.sinistreRepo.count({ where: { numero: Between(`SIN-${year}-00000`, `SIN-${year}-99999`) } });
    return `SIN-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async remove(id: string): Promise<void> {
    const sinistre = await this.findOne(id);
    await this.affaireRepo.update(sinistre.affaireId, {
      sinistresTotal: () => `sinistresTotal - ${sinistre.montantTotal}`,
      sinistresCount: () => 'sinistresCount - 1',
      sapTotal: () => `sapTotal - ${sinistre.sapActuel}`,
    });
    await this.sinistreRepo.delete(id);
  }
}
