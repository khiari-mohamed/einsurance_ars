import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JournalEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { TreatyCalculatorService } from '../affaires/traites/treaty-calculator.service';

/**
 * AccountingEngine — auto-generates BROUILLON journal entries from business events.
 * See individual methods for the account logic (from CDC Section VI).
 */
@Injectable()
export class AccountingEngineService {
  private readonly logger = new Logger(AccountingEngineService.name);

  constructor(
    private prisma: PrismaService,
    private fiscalPeriod: FiscalPeriodService,
    private sequence: SequenceService,
    private auxiliary: AuxiliaryAccountService,
    private treatyCalculator: TreatyCalculatorService,
  ) {}

  // ── FACULTATIVE — CDC §VI.a ───────────────────────────────────────

  async generateForFacultativeAffaire(affaireId: string): Promise<string> {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: {
        facultativeData: true,
        cedante: true,
        reassureurs: { include: { reassureur: true } },
      },
    });

    if (!affaire.facultativeData) throw new BadRequestException('Données facultatives manquantes');

    // FIX (Comptabilité pass): no idempotency guard existed — calling this
    // twice created two full entries for the same affaire.
    await this.assertNotAlreadyGenerated(JournalEntryType.PASSATION_CA_FACULTATIVE, affaireId, affaire.numero);

    const fac = affaire.facultativeData;
    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');

    const [cedanteAccount, arsCommAccount, cedanteCommAccount, reassureurAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '705' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '613' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } }),
    ]);

    const totalArsComm = affaire.reassureurs.reduce((s, r) => s + Number(r.commissionArs ?? 0), 0);
    const commissionCedante = Number(fac.commissionCedante ?? 0);

    // FIX (Comptabilité pass): previously only cedanteAccount was checked —
    // a missing arsCommAccount/cedanteCommAccount/reassureurAccount
    // silently dropped that line (filtered out by planComptableId), which
    // could produce a BROUILLON entry with a debit and NO matching credit
    // lines — an unbalanced entry stuck forever failing validate(), with no
    // clear error explaining why. All required accounts are validated up
    // front now; a missing one is a hard, actionable error instead.
    const missing: string[] = [];
    if (!cedanteAccount) missing.push('411xxxxx (cédantes)');
    if (totalArsComm > 0 && !arsCommAccount) missing.push('705xxxxx (commission courtage ARS)');
    if (commissionCedante > 0 && !cedanteCommAccount) missing.push('613xxxxx (commission cédante)');
    if (affaire.reassureurs.length > 0 && !reassureurAccount) missing.push('401xxxxx (réassureurs)');
    if (missing.length > 0) {
      throw new BadRequestException(
        `Comptes manquants dans le plan comptable, impossible de générer l'écriture: ${missing.join(', ')}`,
      );
    }

    const lines: any[] = [];
    let lineOrder = 1;

    const auxCedante = await this.auxiliary.createForCedante(affaire.cedanteId, affaire.cedante.compteComptable, affaire.cedante.raisonSociale);

    lines.push({
      planComptableId: cedanteAccount!.id,
      auxiliaryId: auxCedante?.id,
      cedanteId: affaire.cedanteId,
      debit: Number(fac.primeCedee ?? 0),
      credit: null,
      libelle: `Prime cédée — ${affaire.numero}`,
      ordre: lineOrder++,
    });

    if (totalArsComm > 0) {
      lines.push({
        planComptableId: arsCommAccount!.id,
        debit: null,
        credit: Math.round(totalArsComm * 1000) / 1000,
        libelle: `Commission courtage ARS — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    if (commissionCedante > 0) {
      lines.push({
        planComptableId: cedanteCommAccount!.id,
        debit: null,
        credit: commissionCedante,
        libelle: `Commission cédante — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    for (const r of affaire.reassureurs) {
      const primeNette = Number(r.primeNetteReassureur ?? 0);
      if (primeNette <= 0) continue;
      const auxRea = await this.auxiliary.createForReassureur(r.reassureurId, r.reassureur.compteComptable, r.reassureur.raisonSociale);
      lines.push({
        planComptableId: reassureurAccount!.id,
        auxiliaryId: auxRea?.id,
        reassureurId: r.reassureurId,
        debit: null,
        credit: primeNette,
        libelle: `Prime nette réassureur ${r.reassureur.code} — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.PASSATION_CA_FACULTATIVE,
        affaireId,
        fiscalPeriodId: period.id,
        currency: affaire.currency,
        description: `Passation CA facultative — ${affaire.numero}`,
        lines: { create: lines },
      },
    });

    this.logger.log(`Journal entry created: ${entry.numero} for affaire ${affaire.numero}`);
    return entry.id;
  }

  /**
   * NEW (Comptabilité pass): CDC §VI.b explicitly documents this ("1-
   * Passation du chiffre d'affaires (Bordereaux de Cession) par
   * trimestre") — JournalEntryType.PASSATION_CA_TRAITE existed with zero
   * implementation.
   *
   * SCOPE NOTE: this books the PRIME side only (matching the CDC section's
   * literal title — "passation du chiffre d'affaires"). Sinistres/SAP
   * booking for treaties has its own dedicated JournalEntryTypes
   * (SAP_RECONSTITUTION, LIQUIDATION_TRAITE) and is a separate feature,
   * not implemented here — flagging as a follow-up rather than
   * approximating it.
   *
   * Commission split is computed LIVE via TreatyCalculatorService rather
   * than read from AffaireReassureur.commissionArs, because — unlike
   * facultative affaires — nothing in TraitesService currently persists a
   * treaty's commission distribution back onto AffaireReassureur (verified
   * against the Traités module reviewed earlier); those fields stay null
   * for every treaty. Reading them here would silently generate a
   * zero-commission entry. This computes the real split from the
   * compiled Situation's totalDebit instead.
   */
  async generateForTraiteSituation(situationId: string): Promise<string> {
    const situation = await this.prisma.situation.findUnique({
      where: { id: situationId },
      include: {
        cedante: true,
        traite: { include: { affaire: { include: { reassureurs: { include: { reassureur: true } } } } } },
      },
    });
    if (!situation) throw new NotFoundException('Situation introuvable');
    if (!situation.traiteId || !situation.traite) {
      throw new BadRequestException('Cette situation n\'est pas liée à un traité — utilisez la génération facultative pour les affaires facultatives');
    }

    const traiteAffaire = situation.traite.affaire;
    await this.assertNotAlreadyGenerated(JournalEntryType.PASSATION_CA_TRAITE, traiteAffaire.id, situation.reference);

    const totalDebit = Number(situation.totalDebit ?? 0);
    if (totalDebit <= 0) {
      throw new BadRequestException('Le débit total (primes) de cette situation est nul — rien à comptabiliser');
    }

    const distribution = this.treatyCalculator.calculateTreatyDistribution({
      primeNetteCedante: totalDebit,
      reassureurs: traiteAffaire.reassureurs.map((r) => ({
        reassureurId: r.reassureurId,
        partPct: Number(r.partPct),
        commissionMode: r.commissionMode,
        tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
        commissionForfait: r.commissionForfait ? Number(r.commissionForfait) : undefined,
      })),
    });

    const [cedanteAccount, arsCommAccount, reassureurAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '705' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } }),
    ]);

    const totalArsComm = distribution.reduce((s, d) => s + d.commissionArs, 0);

    const missing: string[] = [];
    if (!cedanteAccount) missing.push('411xxxxx (cédantes)');
    if (totalArsComm > 0 && !arsCommAccount) missing.push('705xxxxx (commission courtage ARS)');
    if (distribution.length > 0 && !reassureurAccount) missing.push('401xxxxx (réassureurs)');
    if (missing.length > 0) {
      throw new BadRequestException(`Comptes manquants dans le plan comptable: ${missing.join(', ')}`);
    }

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const auxCedante = await this.auxiliary.createForCedante(situation.cedanteId, situation.cedante.compteComptable, situation.cedante.raisonSociale);

    const lines: any[] = [
      {
        planComptableId: cedanteAccount!.id,
        auxiliaryId: auxCedante?.id,
        cedanteId: situation.cedanteId,
        debit: totalDebit,
        credit: null,
        libelle: `Passation CA traité — ${situation.reference}`,
        ordre: 1,
      },
    ];
    let lineOrder = 2;

    if (totalArsComm > 0) {
      lines.push({
        planComptableId: arsCommAccount!.id,
        debit: null,
        credit: Math.round(totalArsComm * 1000) / 1000,
        libelle: `Commission courtage ARS — ${situation.reference}`,
        ordre: lineOrder++,
      });
    }

    for (const d of distribution) {
      if (d.primeNetteReassureur <= 0) continue;
      const r = traiteAffaire.reassureurs.find((x) => x.reassureurId === d.reassureurId)!;
      const auxRea = await this.auxiliary.createForReassureur(d.reassureurId, r.reassureur.compteComptable, r.reassureur.raisonSociale);
      lines.push({
        planComptableId: reassureurAccount!.id,
        auxiliaryId: auxRea?.id,
        reassureurId: d.reassureurId,
        debit: null,
        credit: d.primeNetteReassureur,
        libelle: `Prime nette réassureur ${r.reassureur.code} — ${situation.reference}`,
        ordre: lineOrder++,
      });
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.PASSATION_CA_TRAITE,
        affaireId: traiteAffaire.id,
        fiscalPeriodId: period.id,
        currency: situation.currency,
        description: `Passation CA traité — ${situation.reference}`,
        lines: { create: lines },
      },
    });

    this.logger.log(`Journal entry created: ${entry.numero} for situation ${situation.reference}`);
    return entry.id;
  }
  // ── ENCAISSEMENT / DECAISSEMENT — cash movements ──────────────────

  async generateForEncaissement(encaissementId: string): Promise<string> {
    const enc = await this.prisma.encaissement.findUniqueOrThrow({
      where: { id: encaissementId },
      include: { cedante: true, affaire: { select: { numero: true } } },
    });

    // FIX (Comptabilité pass): no idempotency guard — same call twice
    // duplicated the entry.
    const existing = await this.prisma.journalEntry.findFirst({
      where: { description: { contains: enc.reference } },
    });
    if (existing) {
      throw new ConflictException(`Une écriture existe déjà pour l'encaissement ${enc.reference} (${existing.numero})`);
    }

    const bankAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: enc.currency === 'TND' ? '5320' : enc.currency === 'USD' ? '5321' : '5322' } },
    });
    const cedanteAccount = enc.cedanteId
      ? await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } })
      : null;

    if (!bankAccount) {
      throw new BadRequestException(`Compte de banque manquant pour la devise ${enc.currency} — configuration du plan comptable requise`);
    }
    if (enc.cedanteId && !cedanteAccount) {
      throw new BadRequestException('Compte 411xxxxx (cédantes) manquant dans le plan comptable');
    }

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const montant = Number(enc.montantTnd ?? enc.montant);

    const lines: any[] = [
      { planComptableId: bankAccount.id, debit: montant, credit: null, libelle: `Encaissement ${enc.reference}`, ordre: 1 },
    ];

    if (enc.cedanteId && cedanteAccount) {
      const auxCedante = await this.auxiliary.createForCedante(enc.cedanteId, enc.cedante!.compteComptable, enc.cedante!.raisonSociale);
      lines.push({
        planComptableId: cedanteAccount.id, auxiliaryId: auxCedante?.id, cedanteId: enc.cedanteId,
        debit: null, credit: montant, libelle: `Encaissement ${enc.reference} — ${enc.cedante!.raisonSociale}`, ordre: 2,
      });
    } else {
      // No party to credit against a specific tiers account — book to the
      // bank's own counterpart placeholder isn't correct double-entry, so
      // this case (e.g. BANQUE_ARS/ASSURE party types) is intentionally
      // left for manual completion rather than guessed.
      throw new BadRequestException(
        'Génération automatique non supportée pour ce type de partie versante — complétez l\'écriture manuellement.',
      );
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero, statut: 'BROUILLON', type: JournalEntryType.ENCAISSEMENT_PRIME_CEDEE,
        affaireId: enc.affaireId, fiscalPeriodId: period.id, currency: enc.currency,
        description: `Encaissement ${enc.reference}${enc.affaire ? ' — ' + enc.affaire.numero : ''}`,
        lines: { create: lines },
      },
    });

    return entry.id;
  }

  async generateForDecaissement(decaissementId: string): Promise<string> {
    const dec = await this.prisma.decaissement.findUniqueOrThrow({ where: { id: decaissementId } });

    const existing = await this.prisma.journalEntry.findFirst({
      where: { description: { contains: dec.reference } },
    });
    if (existing) {
      throw new ConflictException(`Une écriture existe déjà pour le décaissement ${dec.reference} (${existing.numero})`);
    }

    const bankAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: dec.currency === 'TND' ? '5320' : dec.currency === 'USD' ? '5321' : '5322' } },
    });
    const reassureurAccount = dec.reassureurCode
      ? await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } })
      : null;

    if (!bankAccount) {
      throw new BadRequestException(`Compte de banque manquant pour la devise ${dec.currency}`);
    }
    if (dec.reassureurCode && !reassureurAccount) {
      throw new BadRequestException('Compte 401xxxxx (réassureurs) manquant dans le plan comptable');
    }
    if (!dec.reassureurCode) {
      throw new BadRequestException('Génération automatique non supportée pour ce bénéficiaire — complétez manuellement.');
    }

    const reassureur = await this.prisma.reassureur.findUnique({ where: { code: dec.reassureurCode } });
    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const montant = Number(dec.montantTnd ?? dec.montant);

    const auxRea = reassureur
      ? await this.auxiliary.createForReassureur(reassureur.id, reassureur.compteComptable, reassureur.raisonSociale)
      : null;

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero, statut: 'BROUILLON', type: JournalEntryType.REGLEMENT_REASSUREUR,
        affaireId: dec.affaireId, fiscalPeriodId: period.id, currency: dec.currency,
        description: `Décaissement ${dec.reference}${reassureur ? ' — ' + reassureur.raisonSociale : ''}`,
        lines: {
          create: [
            {
              planComptableId: reassureurAccount!.id, auxiliaryId: auxRea?.id, reassureurId: reassureur?.id,
              debit: montant, credit: null, libelle: `Règlement ${dec.reference}`, ordre: 1,
            },
            { planComptableId: bankAccount.id, debit: null, credit: montant, libelle: `Décaissement ${dec.reference}`, ordre: 2 },
          ],
        },
      },
    });

    return entry.id;
  }

  /**
   * Books the current-year settlement paid by the cédante on a sinistre.
   * CONFIRMED against server/src/modules/sinistres/sinistres.service.ts:
   * Sinistre.reglementExerciceN is the current-year règlement — there is no
   * `montantPaye` field (that was an incorrect guess in an earlier pass).
   * cumulReglementAnterieurs is prior years' cumulative and is intentionally
   * NOT included here — those were already booked in their own fiscal
   * periods; re-including them would double-count. sap (Sinistres à Payer)
   * is a reserve/provision, not a payment, and is out of scope for this
   * method — it's adjusted via SinistresService.adjustSap() and would need
   * its own reserve-constitution entry type if/when that's requested.
   */
  async generateForSinistrePaiement(sinistreId: string): Promise<string> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { cedante: true } } },
    });

    await this.assertNotAlreadyGenerated(JournalEntryType.SAP_RECONSTITUTION, sinistre.affaireId, sinistre.numero ?? sinistreId);

    const montantRegle = Number(sinistre.reglementExerciceN ?? 0);
    if (montantRegle <= 0) {
      throw new BadRequestException('Aucun règlement exercice courant enregistré sur ce sinistre — rien à comptabiliser.');
    }

    const sinistreAccount = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '622' } } });
    const cedanteAccount = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } });
    if (!sinistreAccount) throw new BadRequestException('Compte de sinistres (classe 622x) manquant dans le plan comptable — à créer avant génération.');
    if (!cedanteAccount) throw new BadRequestException('Compte 411xxxxx (cédantes) manquant.');

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const aux = await this.auxiliary.createForCedante(sinistre.affaire.cedanteId, sinistre.affaire.cedante.compteComptable, sinistre.affaire.cedante.raisonSociale);

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.SAP_RECONSTITUTION,
        affaireId: sinistre.affaireId,
        sinistreId,
        fiscalPeriodId: period.id,
        currency: sinistre.affaire.currency,
        description: `Règlement sinistre — ${sinistre.numero}`,
        lines: {
          create: [
            { planComptableId: sinistreAccount.id, debit: montantRegle, credit: null, libelle: `Sinistre réglé — ${sinistre.numero}`, ordre: 1 },
            { planComptableId: cedanteAccount.id, auxiliaryId: aux?.id, cedanteId: sinistre.affaire.cedanteId, debit: null, credit: montantRegle, libelle: `Sinistre — ${sinistre.affaire.cedante.raisonSociale}`, ordre: 2 },
          ],
        },
      },
    });

    return entry.id;
  }

  /**
   * Books recovery of the reinsurers' share of a sinistre.
   * CONFIRMED: Sinistre.partReassureurs is the correct field name.
   * INFERRED (not schema-confirmed): SinistreStatut's exact enum values
   * weren't in what I reviewed, but SinistresService's real transition
   * methods (markInRecovery, close — no method exists producing a
   * "RECUPERE" state, unlike an earlier incorrect guess) show
   * EN_RECUPERATION and CLOS are real values. Gating recovery generation on
   * those two rather than the invented EN_RECUPERATION/RECUPERE pair from
   * before.
   */
  async generateForSinistreRecuperation(sinistreId: string): Promise<string> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { reassureurs: { include: { reassureur: true } } } } },
    });

    if (!['EN_RECUPERATION', 'CLOS'].includes(sinistre.statut)) {
      throw new BadRequestException(`Le sinistre doit être en cours de récupération ou clos pour générer cette écriture (statut actuel: ${sinistre.statut})`);
    }

    await this.assertNotAlreadyGenerated(JournalEntryType.LIQUIDATION_TRAITE, sinistre.affaireId, `récup-${sinistre.numero ?? sinistreId}`);

    const partReassureurs = Number(sinistre.partReassureurs ?? 0);
    if (partReassureurs <= 0) {
      throw new BadRequestException('Aucune part réassureurs sur ce sinistre — rien à récupérer.');
    }

    const sinistreAccount = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '622' } } });
    const reassureurAccount = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } });
    if (!sinistreAccount) throw new BadRequestException('Compte de sinistres (classe 622x) manquant.');
    if (!reassureurAccount) throw new BadRequestException('Compte 401xxxxx (réassureurs) manquant.');

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const lines: any[] = [];
    let ordre = 1;

    for (const r of sinistre.affaire.reassureurs) {
      const part = Math.round(partReassureurs * (Number(r.partPct) / 100) * 1000) / 1000;
      if (part <= 0) continue;
      const aux = await this.auxiliary.createForReassureur(r.reassureurId, r.reassureur.compteComptable, r.reassureur.raisonSociale);
      lines.push({
        planComptableId: reassureurAccount.id,
        auxiliaryId: aux?.id,
        reassureurId: r.reassureurId,
        debit: part,
        credit: null,
        libelle: `Récupération sinistre ${sinistre.numero} — ${r.reassureur.code}`,
        ordre: ordre++,
      });
    }
    lines.push({ planComptableId: sinistreAccount.id, debit: null, credit: partReassureurs, libelle: `Récupération sinistre ${sinistre.numero}`, ordre: ordre++ });

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.LIQUIDATION_TRAITE,
        affaireId: sinistre.affaireId,
        sinistreId,
        fiscalPeriodId: period.id,
        currency: sinistre.affaire.currency,
        description: `Récupération sinistre auprès des réassureurs — ${sinistre.numero}`,
        lines: { create: lines },
      },
    });

    return entry.id;
  }

  // ── Shared helper ────────────────────────────────────────────────

  private async assertNotAlreadyGenerated(type: JournalEntryType, affaireId: string, refLabel: string) {
    const existing = await this.prisma.journalEntry.findFirst({ where: { type, affaireId } });
    if (existing) {
      throw new ConflictException(`Une écriture ${type} existe déjà pour ${refLabel} (${existing.numero})`);
    }
  }
}