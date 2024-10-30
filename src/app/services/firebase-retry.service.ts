import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap, finalize } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FirebaseRetryService {
  retryOperation<T>(operation: Observable<T>, maxRetries: number = 3, delayMs: number = 2000): Observable<T> {
    return operation.pipe(
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error, index) => {
            const retryAttempt = index + 1;
            if (retryAttempt > maxRetries) {
              return throwError(() => new Error('Maximum retry attempts reached'));
            }
            console.log(`Attempt ${retryAttempt}: retrying in ${delayMs}ms`);
            return timer(delayMs);
          })
        )
      ),
      finalize(() => console.log('Firebase operation completed'))
    );
  }
}