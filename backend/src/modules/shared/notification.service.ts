import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Email implementation placeholder
    console.log(`Email to ${to}: ${subject}`);
  }

  async notifyWorkflowChange(entityType: string, entityId: string, status: string): Promise<void> {
    // Workflow notification placeholder
    console.log(`Workflow: ${entityType} ${entityId} -> ${status}`);
  }
}
