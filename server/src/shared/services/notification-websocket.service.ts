import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { NotificationPayload } from './notification.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationWebsocketService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationWebsocketService.name);
  private userSockets = new Map<string, string>(); // userId → socketId

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) this.userSockets.set(userId, client.id);
    this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
  }

  handleDisconnect(client: Socket) {
    this.userSockets.forEach((socketId, userId) => {
      if (socketId === client.id) this.userSockets.delete(userId);
    });
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('notification.created')
  handleNotification(payload: NotificationPayload) {
    if (payload.userId) {
      const socketId = this.userSockets.get(payload.userId);
      if (socketId) {
        this.server.to(socketId).emit('notification', payload);
      }
    } else {
      // Broadcast to all — will be filtered on client by role
      this.server.emit('notification', payload);
    }
  }
}