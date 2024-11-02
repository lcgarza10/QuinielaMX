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
    throw new Error('No hay conexión a internet');
  }

  // Filter out invalid predictions
  const validPredictions = predictions.filter(
    p => p.matchId && p.homeScore !== null && p.awayScore !== null
  );

  if (validPredictions.length === 0) {
    throw new Error('No hay predicciones válidas para guardar');
  }

  // Reference to the Firestore document
  const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`).ref;

  try {
    // Fetch existing data once to minimize read operations
    const docSnapshot = await docRef.get();
    const existingData = docSnapshot.data() as PredictionDocument | undefined;
    const existingPredictions = existingData?.predictions || [];

    // Create a map of existing predictions by matchId
    const predictionMap = new Map(
      existingPredictions.map(p => [p.matchId, p])
    );

    // Update or add new predictions
    validPredictions.forEach(prediction => {
      predictionMap.set(prediction.matchId, prediction);
    });

    // Prepare the updated document data
    const updatedPredictions = Array.from(predictionMap.values());
    const docData: PredictionDocument = {
      predictions: updatedPredictions,
      totalPoints,
      lastUpdated: firebase.firestore.Timestamp.now(),
    };

    // Use a batched write to update the document
    const batch = this.afs.firestore.batch();
    batch.set(docRef, docData, { merge: true });
    await batch.commit();

    console.log('Successfully saved predictions');
  } catch (error) {
    console.error('Error saving predictions:', error);
    throw new Error('Error al guardar las predicciones');
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