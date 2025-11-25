import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const startTime = Date.now();

    this.logger.info(`Started ${method} "${originalUrl}" for ${ip}`, {
      context: 'HTTP',
    });

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get('content-length') || 0;
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      this.logger[logLevel](`Completed ${statusCode} in ${duration}ms (${contentLength} bytes)`, {
        context: 'HTTP',
        method,
        url: originalUrl,
        statusCode,
        duration,
        contentLength,
      });
    });

    next();
  }
}
