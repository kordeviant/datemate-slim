import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ResponseResult } from '../dtos/response-result.dto';

@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    let message = 'An error occurred';
    let errorType = 'WS_ERROR';

    if (exception instanceof WsException) {
      const err = exception.getError();
      if (typeof err === 'string') {
        message = err;
      } else if (typeof err === 'object' && err !== null) {
        message = (err as any).message || message;
        errorType = (err as any).type || errorType;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if (exception.name === 'JsonWebTokenError' || exception.name === 'TokenExpiredError') {
        errorType = 'UNAUTHORIZED';
      }
    }

    this.logger.warn(`WebSocket Error for client ${client.id}: ${message}`);

    const envelope: ResponseResult<null> = {
      status: 'error',
      message,
      data: null,
      error: {
        type: errorType,
        message,
      },
    };

    client.emit('error', envelope);
  }
}
