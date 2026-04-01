import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Decaissement } from './decaissement.entity';
import { NotificationService } from './notification.service';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

export interface AMLFinding {
  type: 'LARGE_AMOUNT' | 'SUSPICIOUS_PATTERN' | 'FREQUENT_TRANSFERS' | 'HIGH_RISK_COUNTRY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  entityId: string;
  entityType: string;
  montant: number;
  date: Date;
  recommendation: string;
}

@Injectable()
export class AMLService {
  // Configuration thresholds
  private readonly LARGE_PAYMENT_THRESHOLD = 50000; // TND
  private readonly MEDIUM_PAYMENT_THRESHOLD = 20000; // TND
  private readonly DAILY_LIMIT = 200000; // TND

  // High-risk countries (simplified list - should be updated from external source)
  private readonly HIGH_RISK_COUNTRIES = ['KP', 'IR', 'SY', 'CU']; // ISO country codes

  // Suspicious patterns configuration
  private readonly PATTERN_CONFIG = {
    MULTIPLE_TRANSFERS_24H: { count: 5, threshold: 100000 }, // 5+ transfers > 100k in 24h
    ROUND_AMOUNTS: { tolerance: 0.01, suspicious: true }, // Exact round amounts
    FREQUENT_RECIPIENTS: { count: 10, days: 30 }, // 10+ different recipients in 30 days
  };

  constructor(
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private notificationService: NotificationService,
  ) {}

  /**
   * Screen a single payment for AML risk
   */
  async screenPayment(decaissementId: string, userId: string): Promise<AMLFinding[]> {
    const decaissement = await this.decaissementRepo.findOne({
      where: { id: decaissementId },
      relations: ['reassureur', 'cedante'],
    });

    if (!decaissement) {
      return [];
    }

    const findings: AMLFinding[] = [];

    // 1. Check large amount
    if (Number(decaissement.montantEquivalentTND) >= this.LARGE_PAYMENT_THRESHOLD) {
      findings.push({
        type: 'LARGE_AMOUNT',
        severity: Number(decaissement.montantEquivalentTND) >= 200000 ? 'HIGH' : 'MEDIUM',
        description: `Large payment detected: ${decaissement.montantEquivalentTND.toFixed(2)} TND exceeds ${this.LARGE_PAYMENT_THRESHOLD.toFixed(0)} TND threshold`,
        entityId: decaissementId,
        entityType: 'DECAISSEMENT',
        montant: Number(decaissement.montantEquivalentTND),
        date: new Date(decaissement.dateDecaissement),
        recommendation: 'Require additional approval for amounts > 200,000 TND',
      });
    }

    // 2. Check for round amounts (suspicious)
    if (this.isRoundAmount(Number(decaissement.montant))) {
      findings.push({
        type: 'SUSPICIOUS_PATTERN',
        severity: 'LOW',
        description: `Exact round amount: ${decaissement.montant} ${decaissement.devise}`,
        entityId: decaissementId,
        entityType: 'DECAISSEMENT',
        montant: Number(decaissement.montant),
        date: new Date(decaissement.dateDecaissement),
        recommendation: 'Verify legitimacy of exact amount',
      });
    }

    // 3. Check high-risk countries
    if (decaissement.banqueBeneficiaire?.pays && this.isHighRiskCountry(decaissement.banqueBeneficiaire.pays)) {
      findings.push({
        type: 'HIGH_RISK_COUNTRY',
        severity: 'HIGH',
        description: `Payment to high-risk country: ${decaissement.banqueBeneficiaire.pays}`,
        entityId: decaissementId,
        entityType: 'DECAISSEMENT',
        montant: Number(decaissement.montantEquivalentTND),
        date: new Date(decaissement.dateDecaissement),
        recommendation: 'Enhanced due diligence required - verify beneficial owner',
      });
    }

    // 4. Check for frequent transfers pattern
    const frequentPattern = await this.checkFrequentTransfersPattern(decaissement);
    if (frequentPattern) {
      findings.push(frequentPattern);
    }

    // 5. Check daily limit
    const dailyTotal = await this.getDailyPaymentTotal(decaissement.dateDecaissement);
    if (dailyTotal > this.DAILY_LIMIT) {
      findings.push({
        type: 'SUSPICIOUS_PATTERN',
        severity: 'MEDIUM',
        description: `Daily payment limit exceeded: ${dailyTotal.toFixed(2)} TND > ${this.DAILY_LIMIT.toFixed(0)} TND`,
        entityId: decaissementId,
        entityType: 'DECAISSEMENT',
        montant: dailyTotal,
        date: new Date(decaissement.dateDecaissement),
        recommendation: 'Spread payments across multiple days or obtain director approval',
      });
    }

    // Log findings if any
    if (findings.length > 0) {
      const severityIndex = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      const maxSeverity = findings.reduce((max, f) => {
        return severityIndex[f.severity] > severityIndex[max] ? f.severity : max;
      }, 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL');

      await this.auditLogRepo.save({
        actionType: AuditActionType.CREATE,
        entityType: AuditEntityType.DECAISSEMENT,
        entityId: decaissementId,
        userId,
        userEmail: '',
        severity: maxSeverity,
        description: `AML screening completed: ${findings.length} findings`,
        afterValues: { findings, screeningDate: new Date() },
        requiresReview: maxSeverity === 'HIGH' || maxSeverity === 'CRITICAL',
      });

      // Send email alert for high-risk findings
      if (maxSeverity === 'HIGH' || maxSeverity === 'CRITICAL') {
        await this.notificationService.sendAMLAlertEmail(findings, decaissementId);
      }
    }

    return findings;
  }

  /**
   * Generate AML compliance report
   */
  async generateAMLReport(startDate: string, endDate: string): Promise<any> {
    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(new Date(startDate), new Date(endDate)),
      },
    });

    let totalLargePayments = 0;
    let largePaymentCount = 0;
    let totalRiskPayments = 0;
    const findings: AMLFinding[] = [];

    for (const dec of decaissements) {
      const decFindings = await this.screenPayment(dec.id, 'SYSTEM');
      
      if (Number(dec.montantEquivalentTND) >= this.LARGE_PAYMENT_THRESHOLD) {
        totalLargePayments += Number(dec.montantEquivalentTND);
        largePaymentCount++;
      }

      if (decFindings.length > 0) {
        totalRiskPayments += Number(dec.montantEquivalentTND);
        findings.push(...decFindings);
      }
    }

    const riskPaymentCount = findings.filter(f => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;

    return {
      periode: { startDate, endDate },
      totalPayments: decaissements.length,
      totalAmount: decaissements.reduce((sum, d) => sum + Number(d.montantEquivalentTND), 0),
      largePayments: {
        count: largePaymentCount,
        totalAmount: totalLargePayments,
        percentage: ((largePaymentCount / decaissements.length) * 100).toFixed(2) + '%',
      },
      riskPayments: {
        count: riskPaymentCount,
        totalAmount: totalRiskPayments,
        percentage: ((riskPaymentCount / decaissements.length) * 100).toFixed(2) + '%',
      },
      findings: findings.sort((a, b) => {
        const severityIndex = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
        return severityIndex[b.severity] - severityIndex[a.severity];
      }),
      complianceStatus: riskPaymentCount === 0 ? 'COMPLIANT' : 'REQUIRES_REVIEW',
      recommendation: riskPaymentCount > 0 ? 'Review high-risk payments before execution' : 'No AML concerns detected',
    };
  }

  /**
   * Check if beneficiary is on sanctions list (simplified - should use actual sanctions database)
   */
  async checkSanctionsList(beneficiaryName: string, country: string): Promise<boolean> {
    // This is a simplified implementation
    // In production, should integrate with:
    // - UN Security Council sanctions list
    // - US OFAC list
    // - EU sanctions list
    // - UK sanctions list

    const sanctionedPatterns = ['TERRORIST', 'SANCTIONS', 'BLOCKED'];
    
    return sanctionedPatterns.some(pattern => 
      beneficiaryName.toUpperCase().includes(pattern)
    ) || this.isHighRiskCountry(country);
  }

  /**
   * Monitor for structuring (breaking up payments to avoid detection)
   */
  async detectStructuring(beneficiaryId: string, days: number = 30): Promise<any> {
    const recentPayments = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(
          new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          new Date(),
        ),
      },
    });

    // Detect if multiple payments to same beneficiary that look like they're avoiding threshold
    const structuringThreshold = this.LARGE_PAYMENT_THRESHOLD / 5; // ~10k per transaction
    const suspiciousPattern = recentPayments.filter(p => 
      Number(p.montantEquivalentTND) >= structuringThreshold &&
      Number(p.montantEquivalentTND) < this.LARGE_PAYMENT_THRESHOLD
    );

    if (suspiciousPattern.length >= 5) {
      return {
        isStructuring: true,
        description: `${suspiciousPattern.length} payments between ${structuringThreshold.toFixed(0)} and ${this.LARGE_PAYMENT_THRESHOLD.toFixed(0)} detected in ${days} days`,
        totalAmount: suspiciousPattern.reduce((sum, p) => sum + Number(p.montantEquivalentTND), 0),
        recommendation: 'Investigate for structuring - contact compliance officer',
      };
    }

    return { isStructuring: false };
  }

  // ==================== PRIVATE HELPERS ====================

  private isRoundAmount(amount: number): boolean {
    const roundAmounts = [1000, 5000, 10000, 25000, 50000, 100000];
    return roundAmounts.includes(amount);
  }

  private isHighRiskCountry(countryCode: string): boolean {
    return this.HIGH_RISK_COUNTRIES.includes(countryCode.toUpperCase());
  }

  private async checkFrequentTransfersPattern(decaissement: Decaissement): Promise<AMLFinding | null> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const transfers = await this.decaissementRepo.count({
      where: {
        dateDecaissement: Between(oneDayAgo, new Date()),
        montantEquivalentTND: MoreThan(this.MEDIUM_PAYMENT_THRESHOLD),
      },
    });

    if (transfers >= this.PATTERN_CONFIG.MULTIPLE_TRANSFERS_24H.count) {
      return {
        type: 'FREQUENT_TRANSFERS',
        severity: 'MEDIUM',
        description: `${transfers} transfers exceeding ${this.MEDIUM_PAYMENT_THRESHOLD.toFixed(0)} TND in last 24 hours`,
        entityId: decaissement.id,
        entityType: 'DECAISSEMENT',
        montant: Number(decaissement.montantEquivalentTND),
        date: new Date(decaissement.dateDecaissement),
        recommendation: 'Monitor for unusual activity - possible structuring attempt',
      };
    }

    return null;
  }

  private async getDailyPaymentTotal(date: Date): Promise<number> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const payments = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(dayStart, dayEnd),
      },
    });

    return payments.reduce((sum, p) => sum + Number(p.montantEquivalentTND), 0);
  }
}
