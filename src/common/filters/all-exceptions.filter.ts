import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ResponseResult,
  CallbackErrorTypes,
} from '../dtos/response-result.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorType = CallbackErrorTypes.UNKNOWN_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = Array.isArray(resObj.message)
          ? resObj.message.join(', ')
          : resObj.message || exception.message;

        if (resObj.errorType) {
          errorType = resObj.errorType;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload: ResponseResult<null> = {
      status: 'error',
      message: message,
      data: null,
      error: {
        type: errorType,
        message: message,
      },
    };

    response.status(status).json(payload);
  }
}
