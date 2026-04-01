import { Injectable } from '@nestjs/common';

export enum WorkflowState {
  COTATION = 'cotation',
  PREVISION = 'prevision',
  PLACEMENT_REALISE = 'placement_realise',
  BORDEREAU_EMIS = 'bordereau_emis',
  COMPTABILISE = 'comptabilise',
}

@Injectable()
export class WorkflowEngineService {
  canTransition(from: string, to: string): boolean {
    const transitions = {
      cotation: ['prevision', 'placement_realise'],
      prevision: ['placement_realise'],
      placement_realise: ['bordereau_emis'],
      bordereau_emis: ['comptabilise'],
    };
    return transitions[from]?.includes(to) || false;
  }

  async transition(entityId: string, from: string, to: string): Promise<boolean> {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid transition from ${from} to ${to}`);
    }
    return true;
  }
}
