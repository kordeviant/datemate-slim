import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  sub?: number;
  email?: string;
  role?: string;
  name?: string;
  sessionId?: number;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    if (ctx.getType() === 'http') {
      const request = ctx.switchToHttp().getRequest();
      return request.user;
    }
    const client = ctx.switchToWs().getClient();
    return client.data?.user;
  },
);
