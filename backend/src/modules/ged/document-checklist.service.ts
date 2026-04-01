import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Affaire, AffaireStatus, AffaireCategory } from '../affaires/affaires.entity';

interface ChecklistRequirement {
  key: string;
  label: string;
  requiredFor: AffaireStatus[];
}

@Injectable()
export class DocumentChecklistService {
  private readonly facultativeChecklist: ChecklistRequirement[] = [
    { key: 'noteSynthese', label: 'Note de Synthèse', requiredFor: [AffaireStatus.COTATION, AffaireStatus.PREVISION, AffaireStatus.PLACEMENT_REALISE] },
    { key: 'slipCotation', label: 'Slip de Cotation', requiredFor: [AffaireStatus.PREVISION, AffaireStatus.PLACEMENT_REALISE] },
    { key: 'ordreAssurance', label: "Ordre d'Assurance", requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'slipCouverture', label: 'Slip de Couverture', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'bordereauCession', label: 'Bordereau de Cession', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'conventionCedante', label: 'Convention Cédante', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'conventionReassureur', label: 'Convention Réassureur', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
  ];

  private readonly treatyChecklist: ChecklistRequirement[] = [
    { key: 'noteSynthese', label: 'Note de Synthèse', requiredFor: [AffaireStatus.COTATION, AffaireStatus.PREVISION, AffaireStatus.PLACEMENT_REALISE] },
    { key: 'slipCotation', label: 'Slip de Cotation', requiredFor: [AffaireStatus.PREVISION, AffaireStatus.PLACEMENT_REALISE] },
    { key: 'traitySigned', label: 'Treaty Agreement', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'slipCouverture', label: 'Slip de Couverture', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
    { key: 'conventionCedante', label: 'Convention Cédante', requiredFor: [AffaireStatus.PLACEMENT_REALISE] },
  ];

  constructor(
    @InjectRepository(Affaire)
    private affaireRepository: Repository<Affaire>,
  ) {}

  async getChecklist(affaireId: string): Promise<any> {
    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const requirements = affaire.category === AffaireCategory.FACULTATIVE
      ? this.facultativeChecklist
      : this.treatyChecklist;

    const checklist = affaire.documentChecklist || {};

    return {
      affaireId,
      category: affaire.category,
      currentStatus: affaire.status,
      items: requirements.map(req => ({
        ...req,
        completed: checklist[req.key] || false,
        required: req.requiredFor.includes(affaire.status),
      })),
      completionRate: this.calculateCompletionRate(checklist, requirements, affaire.status),
    };
  }

  async updateChecklist(affaireId: string, updates: Record<string, boolean>): Promise<any> {
    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const currentChecklist = affaire.documentChecklist || {};
    const updatedChecklist = { ...currentChecklist, ...updates };

    await this.affaireRepository.update(affaireId, {
      documentChecklist: updatedChecklist,
    });

    return this.getChecklist(affaireId);
  }

  async validateForStatusChange(affaireId: string, newStatus: AffaireStatus): Promise<{ canProgress: boolean; missingDocuments: string[] }> {
    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const requirements = affaire.category === AffaireCategory.FACULTATIVE
      ? this.facultativeChecklist
      : this.treatyChecklist;

    const checklist = affaire.documentChecklist || {};
    const requiredDocs = requirements.filter(req => req.requiredFor.includes(newStatus));
    const missingDocuments = requiredDocs
      .filter(req => !checklist[req.key])
      .map(req => req.label);

    return {
      canProgress: missingDocuments.length === 0,
      missingDocuments,
    };
  }

  async initializeChecklist(affaireId: string): Promise<void> {
    const affaire = await this.affaireRepository.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    if (!affaire.documentChecklist || Object.keys(affaire.documentChecklist).length === 0) {
      const requirements = affaire.category === AffaireCategory.FACULTATIVE
        ? this.facultativeChecklist
        : this.treatyChecklist;

      const initialChecklist = {};
      requirements.forEach(req => {
        initialChecklist[req.key] = false;
      });

      await this.affaireRepository.update(affaireId, {
        documentChecklist: initialChecklist,
      });
    }
  }

  private calculateCompletionRate(checklist: Record<string, boolean>, requirements: ChecklistRequirement[], currentStatus: AffaireStatus): number {
    const requiredForStatus = requirements.filter(req => req.requiredFor.includes(currentStatus));
    if (requiredForStatus.length === 0) return 100;

    const completed = requiredForStatus.filter(req => checklist[req.key]).length;
    return Math.round((completed / requiredForStatus.length) * 100);
  }

  async getCompletionSummary(affaireIds: string[]): Promise<any[]> {
    const affaires = await this.affaireRepository.findByIds(affaireIds);

    return affaires.map(affaire => {
      const requirements = affaire.category === AffaireCategory.FACULTATIVE
        ? this.facultativeChecklist
        : this.treatyChecklist;

      const checklist = affaire.documentChecklist || {};
      const completionRate = this.calculateCompletionRate(checklist, requirements, affaire.status);

      return {
        affaireId: affaire.id,
        numeroAffaire: affaire.numeroAffaire,
        status: affaire.status,
        completionRate,
        canProgress: completionRate === 100,
      };
    });
  }
}
