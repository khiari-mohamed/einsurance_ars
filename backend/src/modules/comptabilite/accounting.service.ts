import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { AccountingEngineService } from './accounting-engine.service';

@Injectable()
export class AccountingService {
  constructor(
    @Inject(forwardRef(() => AccountingEngineService)) private engine: AccountingEngineService,
  ) {}

  async generateBordereauEntries(bordereau: Bordereau, userId: string): Promise<void> {
    await this.engine.generateBordereauEntries(bordereau, userId);
  }

  async createEncaissementEntry(encaissementId: string, userId: string): Promise<{ reference: string }> {
    return { reference: `ENC-${Date.now()}` };
  }

  async createDecaissementEntry(decaissementId: string, userId: string): Promise<{ reference: string }> {
    return { reference: `DEC-${Date.now()}` };
  }

  async generateSinistreEntries(sinistre: any, userId: string): Promise<void> {
    await this.engine.generateSinistreEntries(sinistre, userId);
  }
}
