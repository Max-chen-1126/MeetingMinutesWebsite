// src/lib/logger.ts

/**
 * 日誌等級
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日誌上下文
 */
export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * 結構化日誌記錄器
 */
class Logger {
  private serviceName: string;
  private environment: string;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'meeting-minutes';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * 記錄 DEBUG 級別日誌
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 記錄 INFO 級別日誌
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 記錄 WARN 級別日誌
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 記錄 ERROR 級別日誌
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }
    } : context;

    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * 核心日誌方法
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
      ...context,
    };

    // 在開發環境使用美化輸出
    if (this.environment === 'development') {
      this.prettyPrint(level, message, context);
    } else {
      // 生產環境輸出 JSON（Cloud Logging 會自動解析）
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * 美化輸出（開發環境）
   */
  private prettyPrint(level: LogLevel, message: string, context?: LogContext): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    const timestamp = new Date().toLocaleTimeString();

    let output = `${color}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`;

    if (context && Object.keys(context).length > 0) {
      output += `\n${JSON.stringify(context, null, 2)}`;
    }

    console.log(output);
  }

  /**
   * 記錄 API 請求
   */
  logRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR :
                  statusCode >= 400 ? LogLevel.WARN :
                  LogLevel.INFO;

    this.log(level, `${method} ${endpoint} ${statusCode}`, {
      ...context,
      method,
      endpoint,
      statusCode,
      duration,
    });
  }

  /**
   * 記錄效能指標
   */
  logMetric(metricName: string, value: number, unit: string, context?: LogContext): void {
    this.info(`Metric: ${metricName}`, {
      ...context,
      metric: {
        name: metricName,
        value,
        unit,
      }
    });
  }
}

// 建立單例實例
const logger = new Logger();

export default logger;

/**
 * 計時器輔助類別
 */
export class Timer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  /**
   * 停止計時並記錄
   */
  end(context?: LogContext): number {
    const duration = Date.now() - this.startTime;
    logger.logMetric(this.label, duration, 'ms', context);
    return duration;
  }

  /**
   * 取得經過時間（不記錄）
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}
