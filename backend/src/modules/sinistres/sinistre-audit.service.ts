import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SinistreAuditLog } from './sinistre-audit.entity';

interface AuditLogData {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  before?: any;
  after?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SinistreAuditService {
  constructor(
    @InjectRepository(SinistreAuditLog) private auditRepo: Repository<SinistreAuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<void> {
    const changes = this.calculateChanges(data.before, data.after);
    
    await this.auditRepo.save(
      this.auditRepo.create({
        ...data,
        changes,
      }),
    );
  }

  private calculateChanges(before: any, after: any): any[] {
    if (!before || !after) return [];

    const changes = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push({
          field: key,
          oldValue: before[key],
          newValue: after[key],
        });
      }
    }

    return changes;
  }

  async getAuditTrail(entityType: string, entityId: string) {
    return this.auditRepo.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
    });
  }
}
