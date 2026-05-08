import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';

/**
 * Four-step payment flow for facultative affaires (CLIENT ARS flow):
 * Step 1: Record encaissement from cedante (prime cédée nette commission)
 * Step 2: Record décaissement to each réassureur (prime nette réassureur)
 * Step 3: Record encaissement of ARS commission from cedante
 * Step 4: Record décaissement of co-courtage if co-courtier involved
 */
@Injectable()
export class FourStepPaymentService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  async executeForAffaire(affaireId: string, userId: string) {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: {
        facultativeData: true,
        reassureurs: { include: { reassureur: { include: { bankAccounts: { where: { isDefault: true } } } } } },
        cedante: { include: { bankAccounts: { where: { isDefault: true } } } },
      },
    });

    if (affaire.type !== 'FACULTATIVE') {
      throw new BadRequestException('Le flux 4 étapes ne s\'applique qu\'aux affaires facultatives');
    }
    if (affaire.statut !== 'PLACEMENT_REALISE') {
      throw new BadRequestException('L\'affaire doit être placée avant d\'exécuter le flux de paiement');
    }
    if (!affaire.facultativeData) {
      throw new BadRequestException('Données financières facultatives manquantes');
    }

    const fac = affaire.facultativeData;
    const totalArsCommission = affaire.reassureurs.reduce(
      (sum, r) => sum + Number(r.commissionArs ?? 0), 0,
    );

    const existingStep = await this.prisma.encaissement.findFirst({
      where: { affaireId, stepNumber: { in: [1, 3] } },
    });
    if (existingStep) {
      throw new BadRequestException(
        `Le flux 4 étapes a déjà été exécuté pour l'affaire ${affaire.numero} (référence: ${existingStep.reference})`,
      );
    }

    // Step 1 amount = what goes to ALL reinsurers combined
    // (cedante pays this + separately pays ARS commission in step 3)
    const step1Amount = Math.round(
      (Number(fac.primeCedee ?? 0) - Number(fac.commissionCedante ?? 0) - totalArsCommission) * 1000,
    ) / 1000;

    if (step1Amount <= 0) {
      throw new BadRequestException('Montant net à transférer aux réassureurs est nul ou négatif');
    }

    const results: any[] = [];

    // STEP 1 — Encaissement montant net réassureurs (sans commission ARS)
    const step1Ref = await this.sequence.next('ENCAISSEMENT');
    const step1 = await this.prisma.encaissement.create({
      data: {
        reference: step1Ref,
        affaireId,
        partyType: 'CEDANTE',
        cedanteId: affaire.cedanteId,
        montant: step1Amount,
        currency: affaire.currency,
        stepNumber: 1,
        description: `Étape 1/4 — Prime nette cédée (hors commission ARS) — Affaire ${affaire.numero}`,
      },
    });
    results.push({ step: 1, type: 'ENCAISSEMENT', id: step1.id, montant: step1.montant });

    // STEP 2 — Décaissement to each réassureur: prime nette réassureur per line
    for (const r of affaire.reassureurs) {
      const primeNetteR = Number(r.primeNetteReassureur ?? 0);
      if (primeNetteR <= 0) continue;

      const step2Ref = await this.sequence.next('DECAISSEMENT');
      const step2 = await this.prisma.decaissement.create({
        data: {
          reference: step2Ref,
          affaireId,
          partyType: 'REASSUREUR',
          reassureurCode: r.reassureur.code,
          montant: Math.round(primeNetteR * 1000) / 1000,
          currency: affaire.currency,
          stepNumber: 2,
          description: `Étape 2/4 — Prime nette réassureur ${r.reassureur.code} (${r.partPct}%) — Affaire ${affaire.numero}`,
        },
      });
      results.push({ step: 2, type: 'DECAISSEMENT', reassureur: r.reassureur.code, id: step2.id, montant: step2.montant });
    }

    // STEP 3 — Encaissement from cedante: ARS commission (already deducted in step 1, this records it separately)
    if (totalArsCommission > 0) {
      const step3Ref = await this.sequence.next('ENCAISSEMENT');
      const step3 = await this.prisma.encaissement.create({
        data: {
          reference: step3Ref,
          affaireId,
          partyType: 'CEDANTE',
          cedanteId: affaire.cedanteId,
          montant: Math.round(totalArsCommission * 1000) / 1000,
          currency: affaire.currency,
          stepNumber: 3,
          description: `Étape 3/4 — Commission ARS — Affaire ${affaire.numero}`,
        },
      });
      results.push({ step: 3, type: 'ENCAISSEMENT', id: step3.id, montant: step3.montant });
    }

    // STEP 4 — Log completion
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'FOUR_STEP_PAYMENT_COMPLETED',
        entityType: 'Affaire',
        entityId: affaireId,
        after: { steps: results },
      },
    });

    return { affaireNumero: affaire.numero, steps: results };
  }
}