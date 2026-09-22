import { Logger } from '@nestjs/common';

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/notifications',

  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',

    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Authenticate socket connection.
   */
  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);

      if (!token) {
        socket.disconnect();

        return;
      }

      const payload = await this.jwtService.verifyAsync(token);

      const userId = payload.userId ?? payload.sub;

      if (!userId) {
        socket.disconnect();

        return;
      }

      socket.data.userId = userId;

      /**
       * Every user gets their own private room.
       *
       * user:<userId>
       */
      await socket.join(this.getUserRoom(userId));

      this.logger.log(`User ${userId} connected via socket ${socket.id}`);
    } catch (error) {
      this.logger.warn(`Socket authentication failed: ${socket.id}`);

      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;

    this.logger.log(
      `Socket disconnected: ${socket.id}, user=${userId ?? 'unknown'}`,
    );
  }

  /**
   * Emit notification to one user.
   */
  emitNotification(userId: string, notification: unknown) {
    this.server
      .to(this.getUserRoom(userId))
      .emit('notification.created', notification);
  }

  /**
   * Emit order update.
   */
  emitOrderUpdate(userId: string, data: unknown) {
    this.server.to(this.getUserRoom(userId)).emit('order.updated', data);
  }

  /**
   * Emit payment success.
   */
  emitPaymentSuccess(userId: string, data: unknown) {
    this.server.to(this.getUserRoom(userId)).emit('payment.succeeded', data);
  }

  /**
   * Emit payment failure.
   */
  emitPaymentFailed(userId: string, data: unknown) {
    this.server.to(this.getUserRoom(userId)).emit('payment.failed', data);
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(socket: Socket): string | undefined {
    /**
     * Client can send:
     *
     * auth: {
     *   token: 'JWT'
     * }
     */

    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === 'string') {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    /**
     * Also support:
     *
     * Authorization: Bearer xxx
     */

    const header = socket.handshake.headers.authorization;

    if (typeof header === 'string') {
      return header.replace(/^Bearer\s+/i, '');
    }

    return undefined;
  }
}
