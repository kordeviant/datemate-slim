import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import {
  ResponseResult,
  CallbackErrorTypes,
} from "../dtos/response-result.dto";
import {
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "@nestjs/jwt";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errorType = CallbackErrorTypes.UNKNOWN_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, any>;
        message = Array.isArray(resObj.message)
          ? resObj.message.join(", ")
          : resObj.message || exception.message;

        if (resObj.errorType) {
          errorType = resObj.errorType;
        }
      }
    } else if (
      exception instanceof TokenExpiredError ||
      (exception instanceof Error && exception.name === "TokenExpiredError")
    ) {
      status = HttpStatus.UNAUTHORIZED;
      message = "Access token has expired";
    } else if (
      exception instanceof JsonWebTokenError ||
      exception instanceof NotBeforeError ||
      (exception instanceof Error &&
        (exception.name === "JsonWebTokenError" ||
          exception.name === "NotBeforeError"))
    ) {
      status = HttpStatus.UNAUTHORIZED;
      message = "Invalid access token";
    } else if (
      (exception as any)?.code === "P2002" ||
      (exception instanceof Error && (exception as any)?.code === "P2002")
    ) {
      status = HttpStatus.CONFLICT;
      const target = (exception as any)?.meta?.target;
      const field = Array.isArray(target) ? target.join(", ") : target || "field";
      message = `A record with this ${field} already exists.`;
      errorType = CallbackErrorTypes.UNKNOWN_ERROR;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
    }

    const logger = new Logger("AllExceptionsFilter");
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      logger.error(
        `[${status}] ${ctx.getRequest()?.method} ${ctx.getRequest()?.url}: ${message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      logger.warn(
        `[${status}] ${ctx.getRequest()?.method} ${ctx.getRequest()?.url}: ${message}`,
      );
    }

    const payload: ResponseResult<null> = {
      status: "error",
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
