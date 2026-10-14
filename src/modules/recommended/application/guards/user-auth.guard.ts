import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../../auth/application/services/token.service';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

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

    request.user = decoded;
    return true;
  }
}
