import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export enum NotificationType {
  AFFAIRE_CREATED = 'affaire:created',
  AFFAIRE_STATUS_CHANGED = 'affaire:status_changed',
  BORDEREAU_GENERATED = 'bordereau:generated',
  PAYMENT_RECEIVED = 'payment:received',
  PAYMENT_SENT = 'payment:sent',
  SINISTRE_DECLARED = 'sinistre:declared',
  SINISTRE_UPDATED = 'sinistre:updated',
  SLIP_RECEIVED = 'slip:received',
  SETTLEMENT_READY = 'settlement:ready',
  ALERT_PAYMENT_DUE = 'alert:payment_due',
  ALERT_DOCUMENT_MISSING = 'alert:document_missing',
  SYSTEM_MESSAGE = 'system:message',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  userId?: string;
  role?: string;
  timestamp: Date;
  read: boolean;
}

@WebSocketGateway({ cors: true, namespace: '/notifications' })
@Injectable()
export class NotificationWebSocketService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationWebSocketService.name);
  private connectedUsers: Map<string, Socket[]> = new Map();
  private notifications: Map<string, Notification[]> = new Map();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    
    if (!userId) {
      client.disconnect();
      return;
    }

    // Store connection
    const userSockets = this.connectedUsers.get(userId) || [];
    userSockets.push(client);
    this.connectedUsers.set(userId, userSockets);

    this.logger.log(`User ${userId} connected (${userSockets.length} active sessions)`);

    // Send pending notifications
    this.sendPendingNotifications(userId, client);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    
    if (userId) {
      const userSockets = this.connectedUsers.get(userId) || [];
      const filtered = userSockets.filter(s => s.id !== client.id);
      
      if (filtered.length > 0) {
        this.connectedUsers.set(userId, filtered);
      } else {
        this.connectedUsers.delete(userId);
      }

      this.logger.log(`User ${userId} disconnected (${filtered.length} remaining sessions)`);
    }
  }

  /**
   * Send notification to specific user
   */
  async notifyUser(userId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
      userId,
    };

    // Store notification
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.push(fullNotification);
    this.notifications.set(userId, userNotifications);

    // Send to all user's active sessions
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.length > 0) {
      userSockets.forEach(socket => {
        socket.emit('notification', fullNotification);
      });
      this.logger.log(`Notification sent to user ${userId}: ${notification.type}`);
    } else {
      this.logger.log(`User ${userId} offline, notification queued`);
    }
  }

  /**
   * Send notification to users by role
   */
  async notifyRole(role: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'userId'>): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
      role,
    };

    // Broadcast to all connected users (they'll filter by role on client side)
    this.server.emit('notification', fullNotification);
    this.logger.log(`Notification broadcast to role ${role}: ${notification.type}`);
  }

  /**
   * Broadcast to all users
   */
  async broadcast(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    this.server.emit('notification', fullNotification);
    this.logger.log(`Broadcast notification: ${notification.type}`);
  }

  /**
   * Send pending notifications to newly connected user
   */
  private sendPendingNotifications(userId: string, socket: Socket): void {
    const userNotifications = this.notifications.get(userId) || [];
    const unread = userNotifications.filter(n => !n.read);

    if (unread.length > 0) {
      socket.emit('pending_notifications', unread);
      this.logger.log(`Sent ${unread.length} pending notifications to user ${userId}`);
    }
  }

  /**
   * Mark notification as read
   */
  @SubscribeMessage('mark_read')
  handleMarkRead(client: Socket, notificationId: string): void {
    const userId = client.handshake.query.userId as string;
    const userNotifications = this.notifications.get(userId) || [];
    
    const notification = userNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.logger.log(`Notification ${notificationId} marked as read by user ${userId}`);
    }
  }

  /**
   * Get user's notifications
   */
  @SubscribeMessage('get_notifications')
  handleGetNotifications(client: Socket): Notification[] {
    const userId = client.handshake.query.userId as string;
    return this.notifications.get(userId) || [];
  }

  /**
   * Clear all notifications for user
   */
  @SubscribeMessage('clear_all')
  handleClearAll(client: Socket): void {
    const userId = client.handshake.query.userId as string;
    this.notifications.delete(userId);
    this.logger.log(`Cleared all notifications for user ${userId}`);
  }

  // ==================== BUSINESS LOGIC NOTIFICATIONS ====================

  async notifyAffaireCreated(affaireId: string, affaireNumero: string, createdBy: string): Promise<void> {
    await this.notifyRole('DIRECTEUR_COMMERCIAL', {
      type: NotificationType.AFFAIRE_CREATED,
      priority: NotificationPriority.MEDIUM,
      title: 'Nouvelle Affaire',
      message: `Affaire ${affaireNumero} créée`,
      data: { affaireId, affaireNumero },
    });
  }

  async notifyPaymentReceived(affaireId: string, montant: number, devise: string, userId: string): Promise<void> {
    await this.notifyUser(userId, {
      type: NotificationType.PAYMENT_RECEIVED,
      priority: NotificationPriority.HIGH,
      title: 'Paiement Reçu',
      message: `Paiement de ${montant} ${devise} reçu`,
      data: { affaireId, montant, devise },
    });

    // Also notify financial service
    await this.notifyRole('AGENT_FINANCIER', {
      type: NotificationType.PAYMENT_RECEIVED,
      priority: NotificationPriority.HIGH,
      title: 'Paiement Reçu',
      message: `Nouveau paiement: ${montant} ${devise}`,
      data: { affaireId, montant, devise },
    });
  }

  async notifySinistreDeclared(sinistreId: string, sinistreNumero: string, montant: number): Promise<void> {
    await this.notifyRole('TECHNICIEN_SINISTRES', {
      type: NotificationType.SINISTRE_DECLARED,
      priority: NotificationPriority.URGENT,
      title: 'Nouveau Sinistre',
      message: `Sinistre ${sinistreNumero} déclaré - Montant: ${montant}`,
      data: { sinistreId, sinistreNumero, montant },
    });
  }

  async notifyPaymentDue(affaireId: string, affaireNumero: string, montant: number, daysOverdue: number): Promise<void> {
    await this.notifyRole('AGENT_FINANCIER', {
      type: NotificationType.ALERT_PAYMENT_DUE,
      priority: daysOverdue > 30 ? NotificationPriority.URGENT : NotificationPriority.HIGH,
      title: 'Paiement en Retard',
      message: `Affaire ${affaireNumero} - Retard de ${daysOverdue} jours`,
      data: { affaireId, affaireNumero, montant, daysOverdue },
    });
  }

  async notifyBordereauGenerated(bordereauId: string, bordereauNumero: string, userId: string): Promise<void> {
    await this.notifyUser(userId, {
      type: NotificationType.BORDEREAU_GENERATED,
      priority: NotificationPriority.MEDIUM,
      title: 'Bordereau Généré',
      message: `Bordereau ${bordereauNumero} prêt`,
      data: { bordereauId, bordereauNumero },
    });
  }

  async notifySlipReceived(slipId: string, affaireNumero: string, reassureur: string): Promise<void> {
    await this.notifyRole('CHARGE_DE_DOSSIER', {
      type: NotificationType.SLIP_RECEIVED,
      priority: NotificationPriority.HIGH,
      title: 'Slip Reçu',
      message: `Slip de ${reassureur} pour ${affaireNumero}`,
      data: { slipId, affaireNumero, reassureur },
    });
  }

  async notifySettlementReady(settlementId: string, cedante: string, montant: number): Promise<void> {
    await this.notifyRole('AGENT_FINANCIER', {
      type: NotificationType.SETTLEMENT_READY,
      priority: NotificationPriority.HIGH,
      title: 'Situation Prête',
      message: `Situation ${cedante} - ${montant} TND`,
      data: { settlementId, cedante, montant },
    });
  }

  async notifySystemMessage(message: string, priority: NotificationPriority = NotificationPriority.MEDIUM): Promise<void> {
    await this.broadcast({
      type: NotificationType.SYSTEM_MESSAGE,
      priority,
      title: 'Message Système',
      message,
      data: {},
    });
  }
}
