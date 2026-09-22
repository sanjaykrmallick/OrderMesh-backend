import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();

    const token = client.handshake.auth?.token;

    if (!token) {
      throw new UnauthorizedException('Missing WebSocket token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      client.data.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid WebSocket token');
    }
  }
}
