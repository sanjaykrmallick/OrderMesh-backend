import { UnauthorizedException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { Socket } from 'socket.io';

export function createWsAuthMiddleware(jwtService: JwtService) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        throw new UnauthorizedException('Missing WebSocket token');
      }

      const payload = await jwtService.verifyAsync(token);

      socket.data.user = payload;

      next();
    } catch {
      next(new Error('Unauthorized WebSocket connection'));
    }
  };
}
