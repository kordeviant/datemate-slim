import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../modules/auth/application/services/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.trim()) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');

    const decoded = await this.tokenService.verifyAccessToken(token);

    if (!decoded || !decoded.sub) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = Number(decoded.sub);
    request.user = {
      id: userId,
      sub: userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    return true;
  }
}
