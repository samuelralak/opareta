import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import type { LoggerService } from '@nestjs/common';

export interface BootstrapLoggerOptions {
  appName: string;
  logLevel?: string;
}

export function createBootstrapLogger(options: BootstrapLoggerOptions): LoggerService {
  const { appName, logLevel = 'info' } = options;
  const isProduction = process.env.NODE_ENV === 'production';

  return WinstonModule.createLogger({
    level: logLevel,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike(appName, {
            colors: !isProduction,
            prettyPrint: true,
            processId: true,
            appName: true,
          })
        ),
      }),
    ],
  });
}
