import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseResult } from '../dtos/response-result.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseResult<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseResult<T>> {
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
