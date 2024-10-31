import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, of, from, throwError, firstValueFrom, combineLatest } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { ConnectionService } from './connection.service';
import { FirebaseRetryService } from './firebase-retry.service';
import { User } from './auth.service';
import { FootballService } from './football.service';

export interface Prediction {
  matchId: number;
  homeScore: number | null;
  awayScore: number | null;
  points?: number;
}

export interface PredictionDocument {
  predictions: Prediction[];
  totalPoints: number;
  lastUpdated: firebase.firestore.Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private isOnline: boolean = true;
  private readonly BATCH_SIZE = 20;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(
    private afs: AngularFirestore,
    private connectionService: ConnectionService,
    private firebaseRetryService: FirebaseRetryService
  ) {
    this.connectionService.getOnlineStatus().subscribe(status => {
      this.isOnline = status;
    });
  }

  getPredictions(userId: string, week: string): Observable<Prediction[]> {
    return this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`).get().pipe(
      map(doc => {
        if (!doc.exists) return [];
        const data = doc.data();
        return data?.predictions || [];
      }),
      catchError(error => {
        console.error('Error getting predictions:', error);
        return of([]);
      })
    );
  }

  async savePredictions(
    userId: string, 
    week: string, 
    predictions: Prediction[], 
    totalPoints: number
  ): Promise<void> {
    if (!this.isOnline) {
      console.warn('Offline: Cannot save predictions while offline');
      return Promise.reject(new Error('No hay conexión a internet'));
    }

    const validPredictions = predictions.filter(p => 
      p.matchId && (p.homeScore !== null && p.awayScore !== null)
    );

    if (validPredictions.length === 0) {
      return Promise.reject(new Error('No hay predicciones válidas para guardar'));
    }

    // Split predictions into batches
    const batches: Prediction[][] = [];
    for (let i = 0; i < validPredictions.length; i += this.BATCH_SIZE) {
      batches.push(validPredictions.slice(i, i + this.BATCH_SIZE));
    }

    const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`);
    let currentRetry = 0;

    while (currentRetry < this.MAX_RETRIES) {
      try {
        // Start a new transaction
        await this.afs.firestore.runTransaction(async transaction => {
          const docSnapshot = await transaction.get(docRef.ref);
          const existingData = docSnapshot.data() as PredictionDocument | undefined;
          const existingPredictions = existingData?.predictions || [];

          // Create a map of existing predictions by matchId
          const predictionMap = new Map(
            existingPredictions.map(p => [p.matchId, p])
          );

          // Update or add new predictions
          for (const prediction of validPredictions) {
            predictionMap.set(prediction.matchId, prediction);
          }

          // Convert map back to array
          const updatedPredictions = Array.from(predictionMap.values());

          // Prepare the document data
          const docData: PredictionDocument = {
            predictions: updatedPredictions,
            totalPoints,
            lastUpdated: firebase.firestore.Timestamp.now()
          };

          // Set the document in the transaction
          transaction.set(docRef.ref, docData, { merge: true });
        });

        console.log('Successfully saved predictions');
        return;
      } catch (error) {
        console.error(`Error saving predictions (attempt ${currentRetry + 1}):`, error);
        currentRetry++;
        
        if (currentRetry === this.MAX_RETRIES) {
          throw new Error('Error al guardar las predicciones después de múltiples intentos');
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
  }

  getAllUsers(): Observable<User[]> {
    return this.firebaseRetryService.retryOperation(
      this.afs.collection<User>('users').valueChanges()
    ).pipe(
      catchError(error => {
        console.error('Error getting users:', error);
        return of([]);
      })
    );
  }

  getUserTotalPoints(userId: string): Observable<number> {
    return this.afs.collection(`predictions/${userId}/weeks`).valueChanges().pipe(
      map((weeks: any[]) => {
        return weeks.reduce((total, week) => total + (week.totalPoints || 0), 0);
      }),
      catchError(error => {
        console.error('Error calculating total points:', error);
        return of(0);
      })
    );
  }

  getAllUsersTotalPoints(): Observable<{ userId: string; totalPoints: number }[]> {
    return this.getAllUsers().pipe(
      switchMap(users => {
        const pointsQueries = users.map(user => 
          this.getUserTotalPoints(user.uid).pipe(
            map(points => ({
              userId: user.uid,
              totalPoints: points
            }))
          )
        );
        return combineLatest(pointsQueries);
      })
    );
  }
}