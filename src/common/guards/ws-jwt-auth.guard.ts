import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { TokenService } from '../../modules/auth/application/services/token.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    if (client.data?.user) {
      return true;
    }

    const token =
      client.handshake?.auth?.accessToken ||
      client.handshake?.auth?.token ||
      this.extractTokenFromHeader(client.handshake?.headers?.authorization);

    if (!token) {
      throw new WsException({ type: 'UNAUTHORIZED', message: 'Missing WebSocket authentication token' });
    }

    try {
      const decoded = await this.tokenService.verifyAccessToken(token);
      client.data.user = {
        id: Number(decoded.sub),
        sub: Number(decoded.sub),
        email: decoded.email,
        role: decoded.role,
      };
      return true;
    } catch (err: any) {
      throw new WsException({ type: 'UNAUTHORIZED', message: err.message || 'Invalid or expired access token' });
    }
  }

  private extractTokenFromHeader(header?: string): string | undefined {
    if (!header) return undefined;
    const [bearer, token] = header.split(' ');
    return bearer === 'Bearer' ? token : header;
  }
}
