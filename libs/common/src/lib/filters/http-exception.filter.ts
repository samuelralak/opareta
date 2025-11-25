import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.resolveException(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }

  private resolveException(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: exception.message
      };
    }

    if (exception instanceof QueryFailedError) {
      const detail = (exception as QueryFailedError & { detail?: string }).detail;

      if (detail?.includes('already exists')) {
        return {
          status: HttpStatus.CONFLICT,
          message: this.parseConflictField(detail)
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error'
    };
  }

  private parseConflictField(detail: string): string {
    const field = detail.match(/Key \((\w+)\)/)?.[1] ?? 'field';
    return `${field.replace('_', ' ')} already exists`;
  }
}
