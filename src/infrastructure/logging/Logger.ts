import winston from "winston";

export class Logger {
  private logger: winston.Logger;
  private name: string;

  constructor({
    logLevel = "info",
    name = "App",
  }: { logLevel?: string; name?: string } = {}) {
    this.name = name;
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} [${level.toUpperCase()}] [${
            this.name
          }]: ${message}${metaStr}`;
        })
      ),
      transports: [new winston.transports.Console()],
    });
  }

  error(message: string | Error, meta?: Record<string, unknown>): void {
    if (message instanceof Error) {
      this.logger.error(message.message, { stack: message.stack, ...meta });
    } else {
      this.logger.error(message, meta);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  debug(
    message: string | Record<string, unknown>,
    meta?: Record<string, unknown>
  ): void {
    if (typeof message === "object") {
      this.logger.debug(JSON.stringify(message), meta);
    } else {
      this.logger.debug(message, meta);
    }
  }
}
