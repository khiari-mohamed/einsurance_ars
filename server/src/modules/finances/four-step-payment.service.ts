import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { ExchangeRateResolverService } from './exchange-rate-resolver.service';

/**
 * Four-step payment flow for facultative affaires (CLIENT ARS flow):
 * Step 1: Record encaissement from cedante (prime cédée nette commission)
 * Step 2: Record décaissement to each réassureur (prime nette réassureur)
 * Step 3: Record encaissement of ARS commission from cedante
 * Step 4: Auto-generate a draft ordre de paiement per reinsurer decaissement
 */
@Injectable()
export class FourStepPaymentService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private exchangeRates: ExchangeRateResolverService,
  ) {}

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
    // FIX (Finances pass, new): this manual flow and the Situation batch-
    // netting flow are mutually exclusive settlement paths for the same
    // money. Running the 4-step flow on a PAR_SITUATION affaire would pay
    // it twice — once here, once again when its Situation is settled.
    if (affaire.modePaiement !== 'PAR_AFFAIRE') {
      throw new BadRequestException(
        'Le flux 4 étapes ne s\'applique qu\'aux affaires en mode de paiement "Par Affaire" (hors situation) — cette affaire est réglée par situation.',
      );
    }
    if (affaire.reassureurs.length === 0) {
      throw new BadRequestException('Aucun réassureur sur cette affaire — impossible d\'exécuter le flux de paiement');
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

    const step1Amount = Math.round(
      (Number(fac.primeCedee ?? 0) - Number(fac.commissionCedante ?? 0) - totalArsCommission) * 1000,
    ) / 1000;

    if (step1Amount <= 0) {
      throw new BadRequestException('Montant net à transférer aux réassureurs est nul ou négatif');
    }

    // FIX (Finances pass, new): the exchange rate was never resolved or
    // recorded anywhere in this flow — every encaissement/decaissement it
    // created had a null taux, meaning no FX gain/loss could ever be
    // computed for a foreign-currency facultative affaire paid this way.
    const taux = await this.exchangeRates.resolve(affaire.currency);

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
        tauxRealisation: taux,
        montantTnd: affaire.currency !== 'TND' ? Math.round(step1Amount * taux * 1000) / 1000 : step1Amount,
        stepNumber: 1,
        description: `Étape 1/4 — Prime nette cédée (hors commission ARS) — Affaire ${affaire.numero}`,
      },
    });
    results.push({ step: 1, type: 'ENCAISSEMENT', id: step1.id, montant: step1.montant });

    // STEP 2 — Décaissement to each réassureur + draft ordre de paiement
    for (const r of affaire.reassureurs) {
      const primeNetteR = Number(r.primeNetteReassureur ?? 0);
      if (primeNetteR <= 0) continue;

      const montantArrondi = Math.round(primeNetteR * 1000) / 1000;

      // NEW (Finances pass): Decaissement.ordrePaiementId exists on the
      // schema specifically for this — a decaissement to a reinsurer needs
      // an actual wire order to execute. Previously nothing ever created
      // one; DAF would have had to notice the decaissement and manually
      // build the OD with no link back to it. Skips gracefully (with a
      // note in the decaissement's description) if the reinsurer has no
      // default bank account on file, rather than failing the whole flow.
      const defaultBank = r.reassureur.bankAccounts[0];
      let ordrePaiementId: string | undefined;

      if (defaultBank) {
        if (affaire.currency !== 'TND' && !defaultBank.swift) {
          results.push({
            step: 2, type: 'WARNING', reassureur: r.reassureur.code,
            message: `Compte bancaire par défaut sans SWIFT — ordre de paiement non généré automatiquement pour ${r.reassureur.raisonSociale}`,
          });
        } else {
          const opRef = await this.sequence.next('ORDRE_PAIEMENT');
          const op = await this.prisma.ordrePaiement.create({
            data: {
              reference: opRef,
              beneficiaire: r.reassureur.raisonSociale,
              bankAccountId: defaultBank.id,
              montant: montantArrondi,
              currency: affaire.currency,
              referenceAffaire: affaire.numero,
              signataires: [],
            },
          });
          ordrePaiementId = op.id;
        }
      } else {
        results.push({
          step: 2, type: 'WARNING', reassureur: r.reassureur.code,
          message: `Aucun compte bancaire par défaut — ordre de paiement à créer manuellement pour ${r.reassureur.raisonSociale}`,
        });
      }

      const step2Ref = await this.sequence.next('DECAISSEMENT');
      const step2 = await this.prisma.decaissement.create({
        data: {
          reference: step2Ref,
          affaireId,
          partyType: 'REASSUREUR',
          reassureurCode: r.reassureur.code,
          montant: montantArrondi,
          currency: affaire.currency,
          tauxReglement: taux,
          montantTnd: affaire.currency !== 'TND' ? Math.round(montantArrondi * taux * 1000) / 1000 : montantArrondi,
          stepNumber: 2,
          ordrePaiementId,
          description: `Étape 2/4 — Prime nette réassureur ${r.reassureur.code} (${r.partPct}%) — Affaire ${affaire.numero}`,
        },
      });
      results.push({ step: 2, type: 'DECAISSEMENT', reassureur: r.reassureur.code, id: step2.id, montant: step2.montant, ordrePaiementId });
    }

    // STEP 3 — Encaissement from cedante: ARS commission
    if (totalArsCommission > 0) {
      const step3Ref = await this.sequence.next('ENCAISSEMENT');
      const step3Amount = Math.round(totalArsCommission * 1000) / 1000;
      const step3 = await this.prisma.encaissement.create({
        data: {
          reference: step3Ref,
          affaireId,
          partyType: 'CEDANTE',
          cedanteId: affaire.cedanteId,
          montant: step3Amount,
          currency: affaire.currency,
          tauxRealisation: taux,
          montantTnd: affaire.currency !== 'TND' ? Math.round(step3Amount * taux * 1000) / 1000 : step3Amount,
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
        after: { steps: results, tauxApplique: taux },
      },
    });

    return { affaireNumero: affaire.numero, tauxApplique: taux, steps: results };
  }
}