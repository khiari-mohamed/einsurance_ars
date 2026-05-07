import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NotificationPayload {
  userId?: string;
  role?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  notify(payload: NotificationPayload) {
    this.logger.log(`Notification [${payload.type}]: ${payload.title}`);
    this.eventEmitter.emit('notification.created', payload);
  }

  notifyRole(role: string, type: string, title: string, message: string, meta?: any) {
    this.notify({ role, type, title, message, meta });
  }

  notifyUser(userId: string, type: string, title: string, message: string, meta?: any) {
    this.notify({ userId, type, title, message, meta });
  }
}