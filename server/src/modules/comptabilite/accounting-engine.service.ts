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

    // Scoped by affaireId — correct here: a Facultative affaire has
    // exactly ONE premium passation event ever (a one-off deal, not
    // recurring), so per-affaire idempotency is the right granularity.
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
   * CDC §VI.b — "1. Passation du chiffre d'affaires (Bordereaux de
   * Cession) par trimestre".
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
    const existing = await this.prisma.journalEntry.findFirst({
      where: { type: JournalEntryType.PASSATION_CA_TRAITE, affaireId: traiteAffaire.id, description: { contains: situation.reference } },
    });
    if (existing) {
      throw new ConflictException(`Une écriture existe déjà pour la situation ${situation.reference} (${existing.numero})`);
    }

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
   */
  async generateForSinistrePaiement(sinistreId: string): Promise<string> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { cedante: true } } },
    });
    await this.assertNotAlreadyGeneratedForSinistre(JournalEntryType.SAP_RECONSTITUTION, sinistreId, sinistre.numero);

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
  async generateForSinistreRecuperation(sinistreId: string): Promise<string> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { reassureurs: { include: { reassureur: true } } } } },
    });

    if (!['EN_RECUPERATION', 'CLOS'].includes(sinistre.statut)) {
      throw new BadRequestException(`Le sinistre doit être en cours de récupération ou clos pour générer cette écriture (statut actuel: ${sinistre.statut})`);
    }

    await this.assertNotAlreadyGeneratedForSinistre(JournalEntryType.RECUPERATION_SINISTRE_REASSUREUR, sinistreId, sinistre.numero);

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
        type: JournalEntryType.RECUPERATION_SINISTRE_REASSUREUR,
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
  async generateForTraiteLiquidation(liquidationId: string): Promise<string> {
    const liquidation = await this.prisma.traiteLiquidation.findUniqueOrThrow({
      where: { id: liquidationId },
      include: {
        traite: {
          include: {
            affaire: { include: { cedante: true, reassureurs: { include: { reassureur: true } } } },
          },
        },
      },
    });

    if (liquidation.statut !== 'VALIDEE') {
      throw new BadRequestException('Seule une liquidation validée peut être comptabilisée.');
    }

    const affaire = liquidation.traite.affaire;
    const reference = `LIQ-${affaire.numero}-${liquidation.periodeDebut.toISOString().slice(0, 10)}`;

    const existing = await this.prisma.journalEntry.findFirst({
      where: { type: JournalEntryType.LIQUIDATION_TRAITE, affaireId: affaire.id, description: { contains: reference } },
    });
    if (existing) {
      throw new ConflictException(`Une écriture existe déjà pour cette liquidation (${existing.numero})`);
    }

    const soldeNet = Number(liquidation.soldeNet);
    if (Math.abs(soldeNet) < 0.001) {
      throw new BadRequestException('Le solde net de cette liquidation est nul — rien à comptabiliser.');
    }
    if (liquidation.soldeDirection !== 'CEDANTE_DOIT') {
      throw new BadRequestException(
        `Comptabilisation automatique non supportée pour le sens "${liquidation.soldeDirection}" — complétez manuellement.`,
      );
    }
    const unmapped: string[] = [];
    if (Number(liquidation.reservesConstituees) > 0) unmapped.push('Réserves constituées (SAP)');
    if (Number(liquidation.reservesLibereesAnterieur) > 0) unmapped.push('Réserves libérées antérieures');
    if (Number(liquidation.participationsBenefRecues) > 0) unmapped.push('Participations bénéficiaires reçues');
    if (Number(liquidation.interetsSurDepots) > 0) unmapped.push('Intérêts sur dépôts');
    if (Number(liquidation.courtage) > 0) unmapped.push('Courtage (distinct de la commission ARS)');
    if (Number(liquidation.taxes) > 0) unmapped.push('Taxes');
    if (Number(liquidation.pmdDeductible) > 0) unmapped.push('PMD déductible');
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `Cette liquidation comporte des montants sur des postes sans compte comptable confirmé dans ce module ` +
        `(${unmapped.join(', ')}). Comptabilisez-les manuellement, ou complétez le mapping de comptes avant ` +
        `de régénérer.`,
      );
    }

    const [cedanteAccount, reassureurAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } }),
    ]);

    const missing: string[] = [];
    if (!cedanteAccount) missing.push('411xxxxx (cédantes)');
    if (!reassureurAccount) missing.push('401xxxxx (réassureurs)');
    if (missing.length > 0) {
      throw new BadRequestException(`Comptes manquants dans le plan comptable: ${missing.join(', ')}`);
    }

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');
    const auxCedante = await this.auxiliary.createForCedante(affaire.cedanteId, affaire.cedante.compteComptable, affaire.cedante.raisonSociale);

    const lines: any[] = [
      {
        planComptableId: cedanteAccount!.id,
        auxiliaryId: auxCedante?.id,
        cedanteId: affaire.cedanteId,
        debit: soldeNet,
        credit: null,
        libelle: `Solde liquidation traité (cédante doit) — ${reference}`,
        ordre: 1,
      },
    ];
    let ordre = 2;

    const totalParts = affaire.reassureurs.reduce((s, r) => s + Number(r.partPct), 0) || 100;
    for (const r of affaire.reassureurs) {
      const share = Math.round(soldeNet * (Number(r.partPct) / totalParts) * 1000) / 1000;
      if (share <= 0) continue;
      const auxRea = await this.auxiliary.createForReassureur(r.reassureurId, r.reassureur.compteComptable, r.reassureur.raisonSociale);
      lines.push({
        planComptableId: reassureurAccount!.id,
        auxiliaryId: auxRea?.id,
        reassureurId: r.reassureurId,
        debit: null,
        credit: share,
        libelle: `Solde liquidation traité ${r.reassureur.code} — ${reference}`,
        ordre: ordre++,
      });
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.LIQUIDATION_TRAITE,
        affaireId: affaire.id,
        fiscalPeriodId: period.id,
        currency: affaire.currency,
        description: `Liquidation traité — ${reference}`,
        lines: { create: lines },
      },
    });

    this.logger.log(`Journal entry created: ${entry.numero} for treaty liquidation ${liquidationId}`);
    return entry.id;
  }

  // ── Shared helpers ───────────────────────────────────────────────
  private async assertNotAlreadyGenerated(type: JournalEntryType, affaireId: string, refLabel: string) {
    const existing = await this.prisma.journalEntry.findFirst({ where: { type, affaireId } });
    if (existing) {
      throw new ConflictException(`Une écriture ${type} existe déjà pour ${refLabel} (${existing.numero})`);
    }
  }
  private async assertNotAlreadyGeneratedForSinistre(type: JournalEntryType, sinistreId: string, refLabel: string) {
    const existing = await this.prisma.journalEntry.findFirst({ where: { type, sinistreId } });
    if (existing) {
      throw new ConflictException(`Une écriture ${type} existe déjà pour le sinistre ${refLabel} (${existing.numero})`);
    }
  }
}