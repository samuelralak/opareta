import { Module, DynamicModule, Global } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

export interface LoggerModuleOptions {
  appName: string;
  logLevel?: string;
  enableFileLogging?: boolean;
  logDir?: string;
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    const { appName, logLevel = 'info', enableFileLogging = false, logDir = 'logs' } = options;
    const isProduction = process.env.NODE_ENV === 'production';

    const transports: winston.transport[] = [
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
    ];

    if (enableFileLogging || isProduction) {
      transports.push(
        new winston.transports.File({
          filename: `${logDir}/${appName}-error.log`,
          level: 'error',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new winston.transports.File({
          filename: `${logDir}/${appName}-combined.log`,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
      );
    }

    return {
      module: LoggerModule,
      imports: [
        WinstonModule.forRoot({
          level: logLevel,
          transports,
          exceptionHandlers: [
            new winston.transports.Console({
              format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            }),
          ],
          rejectionHandlers: [
            new winston.transports.Console({
              format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            }),
          ],
        }),
      ],
      exports: [WinstonModule],
    };
  }
}
