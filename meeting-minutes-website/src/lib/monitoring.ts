// src/lib/monitoring.ts
import { Timer } from './logger';

/**
 * 效能監控類別
 */
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * 記錄指標
   */
  recordMetric(name: string, value: number): void {
    const existing = this.metrics.get(name) || [];
    existing.push(value);

    // 只保留最近 100 筆記錄
    if (existing.length > 100) {
      existing.shift();
    }

    this.metrics.set(name, existing);
  }

  /**
   * 取得指標統計
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);

    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    const min = sorted[0];
    const max = sorted[count - 1];

    const p50 = this.percentile(sorted, 0.5);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    return {
      count,
      avg: Math.round(avg),
      min,
      max,
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
    };
  }

  /**
   * 計算百分位數
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * 取得所有指標摘要
   */
  getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const result: Record<string, ReturnType<typeof this.getStats>> = {};

    for (const [name] of this.metrics) {
      result[name] = this.getStats(name);
    }

    return result;
  }

  /**
   * 清除指標
   */
  clear(): void {
    this.metrics.clear();
  }
}

// 建立單例實例
const monitor = new PerformanceMonitor();

export default monitor;

/**
 * 追蹤 API 回應時間的裝飾器
 */
export function trackApiPerformance(endpoint: string) {
  return function(
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: unknown[]) {
      const timer = new Timer(`api.${endpoint}.duration`);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = timer.end({ endpoint, success: true });

        monitor.recordMetric(`api.${endpoint}.duration`, duration);
        monitor.recordMetric('api.success', 1);

        return result;
      } catch (error) {
        const duration = timer.end({ endpoint, success: false });

        monitor.recordMetric(`api.${endpoint}.duration`, duration);
        monitor.recordMetric('api.error', 1);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 簡化的 API 追蹤包裝器
 */
export async function trackApiCall<T>(
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new Timer(`api.${endpoint}.duration`);

  try {
    const result = await fn();
    const duration = timer.end({ endpoint, success: true });

    monitor.recordMetric(`api.${endpoint}.duration`, duration);
    monitor.recordMetric('api.success', 1);

    return result;
  } catch (error) {
    const duration = timer.end({ endpoint, success: false });

    monitor.recordMetric(`api.${endpoint}.duration`, duration);
    monitor.recordMetric('api.error', 1);

    throw error;
  }
}

/**
 * 錯誤率監控
 */
class ErrorRateMonitor {
  private errors: Map<string, number> = new Map();
  private total: Map<string, number> = new Map();

  /**
   * 記錄請求
   */
  recordRequest(endpoint: string, isError: boolean): void {
    // 更新總數
    const currentTotal = this.total.get(endpoint) || 0;
    this.total.set(endpoint, currentTotal + 1);

    // 如果是錯誤，更新錯誤數
    if (isError) {
      const currentErrors = this.errors.get(endpoint) || 0;
      this.errors.set(endpoint, currentErrors + 1);
    }
  }

  /**
   * 取得錯誤率
   */
  getErrorRate(endpoint: string): number {
    const errors = this.errors.get(endpoint) || 0;
    const total = this.total.get(endpoint) || 0;

    if (total === 0) return 0;

    return (errors / total) * 100;
  }

  /**
   * 取得所有端點的錯誤率
   */
  getAllErrorRates(): Record<string, { errors: number; total: number; rate: number }> {
    const result: Record<string, { errors: number; total: number; rate: number }> = {};

    for (const [endpoint] of this.total) {
      const errors = this.errors.get(endpoint) || 0;
      const total = this.total.get(endpoint) || 0;
      const rate = total > 0 ? (errors / total) * 100 : 0;

      result[endpoint] = { errors, total, rate };
    }

    return result;
  }

  /**
   * 重置統計
   */
  reset(): void {
    this.errors.clear();
    this.total.clear();
  }
}

export const errorRateMonitor = new ErrorRateMonitor();

/**
 * 健康檢查
 */
export function getSystemHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, unknown>;
  timestamp: string;
} {
  const stats = monitor.getAllStats();
  const errorRates = errorRateMonitor.getAllErrorRates();

  // 檢查錯誤率是否過高
  const highErrorRate = Object.values(errorRates).some(
    stat => stat.rate > 10 // 超過 10% 錯誤率
  );

  // 檢查回應時間是否過慢
  const slowResponses = Object.values(stats).some(
    stat => stat && stat.p95 > 5000 // P95 超過 5 秒
  );

  const status = highErrorRate || slowResponses ? 'degraded' : 'healthy';

  return {
    status,
    metrics: {
      performance: stats,
      errorRates,
    },
    timestamp: new Date().toISOString(),
  };
}
