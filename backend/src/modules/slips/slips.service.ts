import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Slip, SlipType } from './slip.entity';
import { Affaire, AffaireStatus } from '../affaires/affaires.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { EmailService } from '../shared/services/email.service';
import { StorageService } from '../shared/services/storage.service';

@Injectable()
export class SlipsService {
  constructor(
    @InjectRepository(Slip) private slipRepo: Repository<Slip>,
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Reassureur) private reassureurRepo: Repository<Reassureur>,
    private emailService: EmailService,
    private storageService: StorageService,
  ) {}

  async createCotationRequest(affaireId: string, reassureurIds: string[], userId: string): Promise<Slip[]> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['cedante', 'assure', 'reinsurers'],
    });

    if (!affaire) throw new NotFoundException('Affaire not found');
    if (affaire.status !== AffaireStatus.DRAFT && affaire.status !== AffaireStatus.COTATION) {
      throw new BadRequestException('Affaire must be in DRAFT or COTATION status');
    }

    const reassureurs = await this.reassureurRepo.find({ where: { id: In(reassureurIds) } });
    if (reassureurs.length !== reassureurIds.length) {
      throw new BadRequestException('Some reinsurers not found');
    }

    const slips: Slip[] = [];

    for (const reassureur of reassureurs) {
      const numero = await this.generateNumero(SlipType.COTATION);
      
      const slip = this.slipRepo.create({
        numero,
        type: SlipType.COTATION,
        affaire: affaire,
        reassureur: reassureur,
        dateEmission: new Date(),
      });

      const saved = await this.slipRepo.save(slip);
      slips.push(saved);

      await this.sendCotationEmail(saved, reassureur, affaire);
    }

    await this.affaireRepo.update(affaireId, { status: AffaireStatus.COTATION });

    return slips;
  }

  async receiveCotationResponse(
    slipId: string,
    data: {
      shareOffered: number;
      tauxCommission: number;
      conditions?: string;
      documentFile?: any;
    },
    userId: string,
  ): Promise<Slip> {
    const slip = await this.findOne(slipId);

    if (slip.type !== SlipType.COTATION) {
      throw new BadRequestException('Only cotation slips can receive responses');
    }

    // Upload document if provided
    let documentPath: string;
    if (data.documentFile) {
      const path = `slips/${slipId}/${Date.now()}_${data.documentFile.originalname}`;
      const result = await this.storageService.uploadFile(path, data.documentFile.buffer, data.documentFile.mimetype);
      documentPath = result.path;
    }

    // Persist only supported fields
    slip.documentPath = documentPath;
    // Map offered share/commission to existing financial fields if applicable
    if (typeof data.shareOffered === 'number') {
      slip.partReassureur = data.shareOffered;
      slip.primeReassureur = Number(((slip.affaire?.primeCedee || 0) * data.shareOffered / 100).toFixed(2));
    }

    return this.slipRepo.save(slip);
  }

  async acceptCotation(slipId: string, userId: string): Promise<Slip> {
    const slip = await this.findOne(slipId);

    // No status field on entity; acceptance will be inferred downstream

    // No status/historique columns on Slip entity, keep minimal persistence

    const saved = await this.slipRepo.save(slip);

    // Update affaire with reinsurer participation
    await this.updateAffaireParticipation(slip.affaire.id, slip.reassureur.id, slip.partReassureur, 0);

    return saved;
  }

  async rejectCotation(slipId: string, reason: string, userId: string): Promise<Slip> {
    const slip = await this.findOne(slipId);

    // No status/historique fields on Slip entity; simply persist as-is or attach a note via document if needed
    return this.slipRepo.save(slip);
  }

  async generateSlipCouverture(affaireId: string, leadReassureurId: string, userId: string): Promise<Slip> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['cedante', 'assure', 'reinsurers', 'reinsurers.reassureur'],
    });

    if (!affaire) throw new NotFoundException('Affaire not found');
    if (affaire.status !== AffaireStatus.PLACEMENT_REALISE) {
      throw new BadRequestException('Affaire must be in PLACEMENT_REALISE status');
    }

    const leadReassureur = affaire.reinsurers.find(r => r.reassureurId === leadReassureurId);
    if (!leadReassureur) {
      throw new BadRequestException('Lead reinsurer not found in affaire');
    }

    const numero = await this.generateNumero(SlipType.COUVERTURE);

    const slip = this.slipRepo.create({
      numero,
      type: SlipType.COUVERTURE,
      affaire: affaire,
      reassureur: leadReassureur.reassureur,
      dateEmission: new Date(),
    });

    const saved = await this.slipRepo.save(slip);

    // Send to leader for signature
    await this.sendSlipCouvEmail(saved, leadReassureur.reassureur, affaire);

    return saved;
  }

  async signSlipCouverture(slipId: string, signatureData: { signedBy: string; documentFile: any }, userId: string): Promise<Slip> {
    const slip = await this.findOne(slipId);

    if (slip.type !== SlipType.COUVERTURE) {
      throw new BadRequestException('Only couverture slips can be signed');
    }

    // Upload signed document
    const path = `slips/${slipId}/signed_${Date.now()}_${signatureData.documentFile.originalname}`;
    const result = await this.storageService.uploadFile(path, signatureData.documentFile.buffer, signatureData.documentFile.mimetype);

    slip.documentPath = result.path;

    const saved = await this.slipRepo.save(slip);

    // Update affaire
    await this.affaireRepo.update(slip.affaire.id, {
      slipReceived: true,
      slipCouvReference: slip.numero,
    });

    return saved;
  }

  async findAll(filters?: {
    affaireId?: string;
    reassureurId?: string;
    type?: SlipType;
  }): Promise<Slip[]> {
    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.affaireId) where.affaire = { id: filters.affaireId };
    if (filters?.reassureurId) where.reassureur = { id: filters.reassureurId };

    return this.slipRepo.find({
      where,
      relations: ['affaire', 'reassureur'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Slip> {
    const slip = await this.slipRepo.findOne({
      where: { id },
      relations: ['affaire', 'affaire.cedante', 'affaire.assure', 'reassureur'],
    });

    if (!slip) throw new NotFoundException('Slip not found');
    return slip;
  }

  private async updateAffaireParticipation(affaireId: string, reassureurId: string, share: number, commission: number): Promise<void> {
    const affaire = await this.affaireRepo.findOne({
      where: { id: affaireId },
      relations: ['reinsurers'],
    });

    const participation = affaire.reinsurers.find(r => r.reassureurId === reassureurId);
    if (participation) {
      participation.share = share;
      participation.primePart = (affaire.primeCedee * share) / 100;
      participation.commissionPart = (participation.primePart * commission) / 100;
      participation.netAmount = participation.primePart - participation.commissionPart;
      await this.affaireRepo.save(affaire);
    }
  }

  private async sendCotationEmail(slip: Slip, reassureur: Reassureur, affaire: Affaire): Promise<void> {
    const subject = `Demande de Cotation - ${affaire.numeroAffaire}`;
    const message = `
      <h2>Demande de Cotation</h2>
      <p>Cher partenaire,</p>
      <p>Nous sollicitons votre cotation pour l'affaire suivante:</p>
      <ul>
        <li><strong>Numéro:</strong> ${affaire.numeroAffaire}</li>
        <li><strong>Assuré:</strong> ${affaire.assure.raisonSociale}</li>
        <li><strong>Branche:</strong> ${affaire.branche}</li>
        <li><strong>Prime cédée:</strong> ${affaire.primeCedee} ${affaire.devise}</li>
        <li><strong>Date émission:</strong> ${slip.dateEmission.toLocaleDateString()}</li>
      </ul>
      <p>Merci de nous faire parvenir votre cotation dans les meilleurs délais.</p>
      <p>Cordialement,<br>ARS Tunisie</p>
    `;

    await this.emailService.sendNotification(reassureur.email, subject, message);
  }

  private async sendSlipCouvEmail(slip: Slip, reassureur: Reassureur, affaire: Affaire): Promise<void> {
    const subject = `Slip de Couverture - ${affaire.numeroAffaire}`;
    const message = `
      <h2>Slip de Couverture</h2>
      <p>Cher partenaire,</p>
      <p>Veuillez trouver ci-joint le slip de couverture pour signature:</p>
      <ul>
        <li><strong>Numéro Slip:</strong> ${slip.numero}</li>
        <li><strong>Affaire:</strong> ${affaire.numeroAffaire}</li>
        <li><strong>Prime totale:</strong> ${affaire.primeCedee} ${affaire.devise}</li>
      </ul>
      <p>En tant que leader, merci de signer et retourner le document.</p>
      <p>Cordialement,<br>ARS Tunisie</p>
    `;

    await this.emailService.sendNotification(reassureur.email, subject, message);
  }

  private async generateNumero(type: SlipType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === SlipType.COTATION ? 'SLIP-COT' : 'SLIP-COUV';
    const count = await this.slipRepo.count({ where: { type } });
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
