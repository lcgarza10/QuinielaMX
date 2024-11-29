import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, tap } from 'rxjs/operators';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
}

export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
};

export function exponentialBackoffRetry(config: RetryConfig = defaultRetryConfig) {
  let retries = 0;
  
  return (source: Observable<any>) =>
    source.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(error => {
            retries++;
            if (retries >= config.maxRetries) {
              throw error;
            }
          }),
          tap(() => {
            const delay = Math.min(
              Math.pow(2, retries) * config.baseDelay,
              config.maxDelay || Infinity
            );
            return timer(delay);
          })
        )
      )
    );
}