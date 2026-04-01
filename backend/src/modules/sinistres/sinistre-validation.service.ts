import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sinistre, SinistreStatus, SinistreDocument } from './sinistres.entity';

@Injectable()
export class SinistreValidationService {
  private readonly requiredDocuments = {
    [SinistreStatus.DECLARE]: ['AVIS_SINISTRE'],
    [SinistreStatus.EN_EXPERTISE]: ['AVIS_SINISTRE', 'DESIGNATION_EXPERT'],
    [SinistreStatus.EN_REGLEMENT]: ['AVIS_SINISTRE', 'RAPPORT_EXPERTISE'],
    [SinistreStatus.REGLE]: ['AVIS_SINISTRE', 'PREUVE_PAIEMENT'],
    [SinistreStatus.CLOS]: ['AVIS_SINISTRE', 'BORDEREAU_CLOTURE'],
  };

  constructor(
    @InjectRepository(SinistreDocument) private documentRepo: Repository<SinistreDocument>,
  ) {}

  async validateDocumentsForStatus(sinistreId: string, newStatus: SinistreStatus): Promise<void> {
    const required = this.requiredDocuments[newStatus];
    if (!required) return;

    const documents = await this.documentRepo.find({ where: { sinistreId } });
    const documentTypes = documents.map(d => d.type);

    for (const requiredType of required) {
      if (!documentTypes.includes(requiredType)) {
        throw new BadRequestException(`Document ${requiredType} is required for status ${newStatus}`);
      }
    }
  }

  async hasDocument(sinistreId: string, type: string): Promise<boolean> {
    const count = await this.documentRepo.count({ where: { sinistreId, type } });
    return count > 0;
  }
}
