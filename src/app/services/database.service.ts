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
    private firebaseRetryService: FirebaseRetryService,
    private footballService: FootballService
  ) {
    this.connectionService.getOnlineStatus().subscribe(status => {
      this.isOnline = status;
    });
  }

  getPredictions(userId: string, week: string): Observable<Prediction[]> {
    return this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`).valueChanges().pipe(
      map(doc => {
        if (!doc) return [];
        return doc.predictions || [];
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
      throw new Error('No hay conexión a internet');
    }

    const validPredictions = predictions.filter(
      p => p.matchId && p.homeScore !== null && p.awayScore !== null
    );

    if (validPredictions.length === 0) {
      throw new Error('No hay predicciones válidas para guardar');
    }

    const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`).ref;

    try {
      const docSnapshot = await docRef.get();
      const existingData = docSnapshot.data() as PredictionDocument | undefined;
      const existingPredictions = existingData?.predictions || [];

      const predictionMap = new Map(
        existingPredictions.map(p => [p.matchId, p])
      );

      validPredictions.forEach(prediction => {
        predictionMap.set(prediction.matchId, prediction);
      });

      const weeklyPoints = Array.from(predictionMap.values()).reduce(
        (total, pred) => total + (pred.points || 0),
        0
      );

      const docData: PredictionDocument = {
        predictions: Array.from(predictionMap.values()),
        totalPoints: weeklyPoints,
        lastUpdated: firebase.firestore.Timestamp.now(),
      };

      const batch = this.afs.firestore.batch();
      batch.set(docRef, docData, { merge: true });

      // Update user's total points
      const userPointsRef = this.afs.doc(`userPoints/${userId}`).ref;
      const userPointsDoc = await userPointsRef.get();
      const currentTotalPoints = userPointsDoc.exists ? (userPointsDoc.data() as any).totalPoints || 0 : 0;

      batch.set(userPointsRef, {
        totalPoints: weeklyPoints,
        lastUpdated: firebase.firestore.Timestamp.now()
      }, { merge: true });

      await batch.commit();

      console.log('Successfully saved predictions and updated total points');
    } catch (error) {
      console.error('Error saving predictions:', error);
      throw new Error('Error al guardar las predicciones');
    }
  }

  getUserTotalPoints(userId: string): Observable<number> {
    return this.afs.collection(`predictions/${userId}/weeks`).valueChanges().pipe(
      map((weeks: any[]) => {
        return weeks.reduce((total, week) => total + (week.totalPoints || 0), 0);
      }),
      catchError(error => {
        console.error('Error getting user total points:', error);
        return of(0);
      })
    );
  }

  getAllUsersTotalPoints(): Observable<{ userId: string; totalPoints: number }[]> {
    return this.afs.collection('users').valueChanges({ idField: 'userId' }).pipe(
      switchMap((users: any[]) => {
        const userPoints$ = users.map(user => 
          this.getUserTotalPoints(user.userId).pipe(
            map(totalPoints => ({
              userId: user.userId,
              totalPoints
            }))
          )
        );
        return combineLatest(userPoints$);
      }),
      catchError(error => {
        console.error('Error getting all users total points:', error);
        return of([]);
      })
    );
  }

  async calculateAndUpdatePoints(userId: string, week: string): Promise<void> {
    try {
      const predictions = await firstValueFrom(this.getPredictions(userId, week));
      const matches = await firstValueFrom(this.footballService.getMatches(parseInt(week)));

      let totalPoints = 0;
      const updatedPredictions = predictions.map(pred => {
        const match = matches.find(m => m.id === pred.matchId);
        if (!match || match.homeScore === null || match.awayScore === null) {
          return pred;
        }

        let points = 0;
        if (pred.homeScore === match.homeScore && pred.awayScore === match.awayScore) {
          points = 3;
        } else {
          const actualResult = Math.sign(match.homeScore - match.awayScore);
          const predictedResult = Math.sign(pred.homeScore! - pred.awayScore!);
          if (actualResult === predictedResult) {
            points = 1;
          }
        }

        totalPoints += points;
        return { ...pred, points };
      });

      await this.savePredictions(userId, week, updatedPredictions, totalPoints);
    } catch (error) {
      console.error('Error calculating and updating points:', error);
      throw error;
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
}