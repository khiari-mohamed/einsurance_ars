import { Injectable, Logger } from '@nestjs/common';
import { JournalEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { SequenceService } from '../../shared/services/sequence.service';

/**
 * AccountingEngine — auto-generates BROUILLON journal entries from business events.
 *
 * Key account logic (from CDC):
 * PASSATION_CA_FACULTATIVE:
 *   DEBIT  411xxxxx (cedante)   = primeCedee
 *   CREDIT 705xxxxx (ARS comm)  = commissionArs
 *   CREDIT 611xxxxx (comm ced)  = commissionCedante
 *   CREDIT 401xxxxx (reassureur) per line = primeNetteReassureur
 *
 * ENCAISSEMENT_PRIME_CEDEE:
 *   DEBIT  532xxxxx (bank)      = montant
 *   CREDIT 411xxxxx (cedante)   = montant
 *
 * REGLEMENT_REASSUREUR:
 *   DEBIT  401xxxxx (reassureur) = montant
 *   CREDIT 532xxxxx (bank)       = montant
 */
@Injectable()
export class AccountingEngineService {
  private readonly logger = new Logger(AccountingEngineService.name);

  constructor(
    private prisma: PrismaService,
    private fiscalPeriod: FiscalPeriodService,
    private sequence: SequenceService,
  ) {}

  async generateForFacultativeAffaire(affaireId: string): Promise<string> {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: {
        facultativeData: true,
        cedante: true,
        reassureurs: { include: { reassureur: true } },
      },
    });

    if (!affaire.facultativeData) throw new Error('Données facultatives manquantes');

    const fac = affaire.facultativeData;
    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');

    // Get accounts
    const [cedanteAccount, arsCommAccount, cedanteCommAccount, bankAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '705' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '613' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '532' } } }),
    ]);

    const totalArsComm = affaire.reassureurs.reduce((s, r) => s + Number(r.commissionArs ?? 0), 0);

    const lines: any[] = [];
    let lineOrder = 1;

    // DEBIT: cedante (prime cédée brute)
    if (cedanteAccount) {
      const auxCedante = await this.prisma.auxiliaryAccount.findFirst({
        where: { cedanteId: affaire.cedanteId },
      });
      lines.push({
        planComptableId: cedanteAccount.id,
        auxiliaryId: auxCedante?.id,
        cedanteId: affaire.cedanteId,
        debit: Number(fac.primeCedee ?? 0),
        credit: null,
        libelle: `Prime cédée — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    // CREDIT: ARS commission
    if (arsCommAccount && totalArsComm > 0) {
      lines.push({
        planComptableId: arsCommAccount.id,
        debit: null,
        credit: Math.round(totalArsComm * 1000) / 1000,
        libelle: `Commission courtage ARS — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    // CREDIT: cedante commission
    if (cedanteCommAccount && Number(fac.commissionCedante ?? 0) > 0) {
      lines.push({
        planComptableId: cedanteCommAccount.id,
        debit: null,
        credit: Number(fac.commissionCedante),
        libelle: `Commission cédante — ${affaire.numero}`,
        ordre: lineOrder++,
      });
    }

    // CREDIT: each reinsurer — prime nette
    const reassureurAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '401' } },
    });
    for (const r of affaire.reassureurs) {
      const primeNette = Number(r.primeNetteReassureur ?? 0);
      if (primeNette <= 0) continue;
      const auxRea = await this.prisma.auxiliaryAccount.findFirst({
        where: { reassureurId: r.reassureurId },
      });
      lines.push({
        planComptableId: reassureurAccount?.id ?? '',
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
        lines: { create: lines.filter((l) => l.planComptableId) },
      },
    });

    this.logger.log(`Journal entry created: ${entry.numero} for affaire ${affaire.numero}`);
    return entry.id;
  }

  async generateForEncaissement(encaissementId: string): Promise<string | null> {
    const enc = await this.prisma.encaissement.findUnique({
      where: { id: encaissementId },
      include: { cedante: true, affaire: true },
    });
    if (!enc) return null;

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');

    const [bankAccount, cedanteAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '532' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } }),
    ]);

    const auxCedante = enc.cedanteId
      ? await this.prisma.auxiliaryAccount.findFirst({ where: { cedanteId: enc.cedanteId } })
      : null;

    const montant = enc.montantTnd ? Number(enc.montantTnd) : Number(enc.montant);

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.ENCAISSEMENT_PRIME_CEDEE,
        affaireId: enc.affaireId,
        fiscalPeriodId: period.id,
        currency: 'TND',
        description: `Encaissement ${enc.reference}`,
        lines: {
          create: [
            {
              planComptableId: bankAccount?.id ?? '',
              debit: montant,
              credit: null,
              libelle: `Encaissement — ${enc.reference}`,
              ordre: 1,
            },
            {
              planComptableId: cedanteAccount?.id ?? '',
              auxiliaryId: auxCedante?.id,
              cedanteId: enc.cedanteId,
              debit: null,
              credit: montant,
              libelle: `Contre-passation cédante — ${enc.reference}`,
              ordre: 2,
            },
          ].filter((l) => l.planComptableId),
        },
      },
    });

    return entry.id;
  }

  async generateForDecaissement(decaissementId: string): Promise<string | null> {
    const dec = await this.prisma.decaissement.findUnique({ where: { id: decaissementId } });
    if (!dec) return null;

    const period = await this.fiscalPeriod.getOrCreateCurrent();
    const numero = await this.sequence.next('JOURNAL_ENTRY');

    const [reassureurAccount, bankAccount] = await Promise.all([
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } }),
      this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '532' } } }),
    ]);

    const auxRea = dec.reassureurCode
      ? await this.prisma.auxiliaryAccount.findFirst({
          where: { reassureur: { code: dec.reassureurCode } },
        })
      : null;

    const montant = dec.montantTnd ? Number(dec.montantTnd) : Number(dec.montant);

    const entry = await this.prisma.journalEntry.create({
      data: {
        numero,
        statut: 'BROUILLON',
        type: JournalEntryType.REGLEMENT_REASSUREUR,
        affaireId: dec.affaireId,
        fiscalPeriodId: period.id,
        currency: 'TND',
        description: `Règlement réassureur ${dec.reassureurCode ?? ''} — ${dec.reference}`,
        lines: {
          create: [
            {
              planComptableId: reassureurAccount?.id ?? '',
              auxiliaryId: auxRea?.id,
              debit: montant,
              credit: null,
              libelle: `Règlement réassureur — ${dec.reference}`,
              ordre: 1,
            },
            {
              planComptableId: bankAccount?.id ?? '',
              debit: null,
              credit: montant,
              libelle: `Virement banque — ${dec.reference}`,
              ordre: 2,
            },
          ].filter((l) => l.planComptableId),
        },
      },
    });

    return entry.id;
  }
}