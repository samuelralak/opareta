import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof QueryFailedError) {
      const detail = (exception as QueryFailedError & { detail?: string }).detail;
      if (detail?.includes('already exists')) {
        status = HttpStatus.CONFLICT;
        message = this.extractConflictField(detail);
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private extractConflictField(detail: string): string {
    const match = detail.match(/Key \((\w+)\)/);
    const field = match ? match[1] : 'field';
    return `${field.replace('_', ' ')} already exists`;
  }
}
