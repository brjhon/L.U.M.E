import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@lume/types';
import type { Request, Response } from 'express';

/**
 * Padroniza todos os erros no formato ApiError (PDF, pág. 14).
 * Erros inesperados viram 500 sem vazar stack ou dados sensíveis.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Erro interno';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        error = b.error ?? exception.name;
      }
    } else {
      this.logger.error(`${req.method} ${req.path} falhou`, (exception as Error)?.stack);
    }

    const payload: ApiError = {
      statusCode,
      error,
      message,
      path: req.path,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(payload);
  }
}
