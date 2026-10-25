import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseResult } from '../dtos/response-result.dto';

export const BYPASS_TRANSFORM_KEY = 'bypass_transform';
export const BypassTransform = () => SetMetadata(BYPASS_TRANSFORM_KEY, true);

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseResult<T> | T>
{
  constructor(private readonly reflector?: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseResult<T> | T> {
    const isBypassed = this.reflector?.getAllAndOverride<boolean>(
      BYPASS_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest();
    const pathname = String(req?.originalUrl || req?.url || req?.path || '');

    if (
      isBypassed ||
      pathname.includes('/geo') ||
      pathname.includes('/downloads') ||
      pathname.includes('/static') ||
      pathname === '/health' ||
      pathname === '/v1/health'
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If data is already wrapped in ResponseResult, return as is
        if (data && typeof data === 'object' && 'status' in data && 'message' in data) {
          return data;
        }
        return {
          status: 'success',
          message: 'Operation successful',
          data: data ?? null,
          error: null,
        };
      }),
    );
  }
}
