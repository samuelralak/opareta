import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
}

interface ValidationErrorResponse {
  message: string[];
  error: string;
  statusCode: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    // Log the actual error for debugging
    if (!(exception instanceof HttpException)) {
      console.error('Unhandled exception:', exception);
    }

    const resolved = this.resolveException(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: resolved.status,
      message: resolved.message,
      timestamp: new Date().toISOString(),
    };

    if (resolved.errors) {
      errorResponse.errors = resolved.errors;
    }

    response.status(resolved.status).json(errorResponse);
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string;
    errors?: Record<string, string[]>;
  } {
    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse() as ValidationErrorResponse;

      if (Array.isArray(exceptionResponse.message)) {
        const errors = this.parseValidationErrors(exceptionResponse.message);
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation failed',
          errors,
        };
      }
    }

    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: exception.message,
      };
    }

    if (exception instanceof QueryFailedError) {
      const detail = (exception as QueryFailedError & { detail?: string }).detail;

      if (detail?.includes('already exists')) {
        return {
          status: HttpStatus.CONFLICT,
          message: this.parseConflictField(detail),
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private parseValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const message of messages) {
      const field = message.split(' ')[0];
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(message);
    }

    return errors;
  }

  private parseConflictField(detail: string): string {
    const field = detail.match(/Key \((\w+)\)/)?.[1] ?? 'field';
    return `${field.replace('_', ' ')} already exists`;
  }
}
