import { Injectable } from '@angular/core';
import { AngularFirestore, SetOptions } from '@angular/fire/compat/firestore';
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

export interface WeekDocument {
  predictions: Prediction[];
  totalPoints: number;
  lastUpdated: firebase.firestore.Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private isOnline: boolean = true;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly serverConfig = { source: 'server' };

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
    return this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`)
      .valueChanges()
      .pipe(
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

    const batch = this.afs.firestore.batch();
    const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`).ref;

    try {
      // Get current matches to calculate points
      const matches = await firstValueFrom(this.footballService.getMatches(parseInt(week)));
      
      // Calculate points for each prediction
      let weeklyPoints = 0;
      const updatedPredictions = validPredictions.map(prediction => {
        const match = matches.find(m => m.id === prediction.matchId);
        let points = 0;

        if (match && match.status.short === 'FT' && 
            match.homeScore !== null && match.awayScore !== null) {
          // Calculate points for finished matches
          if (prediction.homeScore === match.homeScore && 
              prediction.awayScore === match.awayScore) {
            points = 3; // Exact match
          } else {
            const actualResult = Math.sign(match.homeScore - match.awayScore);
            const predictedResult = Math.sign(prediction.homeScore! - prediction.awayScore!);
            if (actualResult === predictedResult) {
              points = 1; // Correct winner/draw
            }
          }
        }

        weeklyPoints += points;
        return { ...prediction, points };
      });

      // Update predictions document with calculated points
      batch.set(docRef, {
        predictions: updatedPredictions,
        totalPoints: weeklyPoints,
        lastUpdated: firebase.firestore.Timestamp.now()
      }, { merge: true });

      // Update user's total points across all weeks
      const userPointsRef = this.afs.doc(`userPoints/${userId}`).ref;
      
      // Get all weeks' points
      const weeksSnapshot = await this.afs.collection(`predictions/${userId}/weeks`)
        .get().toPromise();
      
      let totalUserPoints = weeklyPoints; // Start with current week's points
      
      if (weeksSnapshot) {
        weeksSnapshot.docs.forEach(doc => {
          if (doc.id !== week) { // Don't count current week twice
            const weekData = doc.data() as WeekDocument;
            totalUserPoints += weekData.totalPoints || 0;
          }
        });
      }

      // Update total user points
      batch.set(userPointsRef, {
        totalPoints: totalUserPoints,
        lastUpdated: firebase.firestore.Timestamp.now()
      }, { merge: true });

      await batch.commit();

      console.log(`Updated predictions for week ${week} with total points: ${weeklyPoints}`);
      console.log(`Updated user total points: ${totalUserPoints}`);

    } catch (error) {
      console.error('Error saving predictions:', error);
      throw new Error('Error al guardar las predicciones');
    }
  }

  getUserTotalPoints(userId: string): Observable<number> {
    return this.afs.doc<{ totalPoints: number }>(`userPoints/${userId}`)
      .valueChanges()
      .pipe(
        map(doc => doc?.totalPoints || 0),
        catchError(error => {
          console.error('Error getting user total points:', error);
          return of(0);
        })
      );
  }

  getAllUsersTotalPoints(): Observable<{ userId: string; totalPoints: number }[]> {
    return this.afs.collection('userPoints')
      .valueChanges({ idField: 'userId' })
      .pipe(
        map(docs => 
          docs.map((doc: any) => ({
            userId: doc.userId,
            totalPoints: doc.totalPoints || 0
          }))
        ),
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

      let weeklyPoints = 0;
      const updatedPredictions = predictions.map(pred => {
        const match = matches.find(m => m.id === pred.matchId);
        let points = 0;

        if (match && match.status.short === 'FT' && 
            match.homeScore !== null && match.awayScore !== null) {
          if (pred.homeScore === match.homeScore && pred.awayScore === match.awayScore) {
            points = 3;
          } else {
            const actualResult = Math.sign(match.homeScore - match.awayScore);
            const predictedResult = Math.sign(pred.homeScore! - pred.awayScore!);
            if (actualResult === predictedResult) {
              points = 1;
            }
          }
        }

        weeklyPoints += points;
        return { ...pred, points };
      });

      const batch = this.afs.firestore.batch();
      
      // Update week document
      const weekRef = this.afs.doc(`predictions/${userId}/weeks/${week}`).ref;
      batch.set(weekRef, {
        predictions: updatedPredictions,
        totalPoints: weeklyPoints,
        lastUpdated: firebase.firestore.Timestamp.now()
      }, { merge: true });

      // Update total points
      const userPointsRef = this.afs.doc(`userPoints/${userId}`).ref;
      const weeksSnapshot = await this.afs.collection(`predictions/${userId}/weeks`)
        .get().toPromise();
      
      let totalPoints = 0;
      if (weeksSnapshot) {
        weeksSnapshot.docs.forEach(doc => {
          if (doc.id === week) {
            totalPoints += weeklyPoints;
          } else {
            const weekData = doc.data() as WeekDocument;
            totalPoints += weekData.totalPoints || 0;
          }
        });
      }

      batch.set(userPointsRef, {
        totalPoints,
        lastUpdated: firebase.firestore.Timestamp.now()
      }, { merge: true });

      await batch.commit();

    } catch (error) {
      console.error('Error calculating and updating points:', error);
      throw error;
    }
  }

  getAllUsers(): Observable<User[]> {
    return this.afs.collection<User>('users')
      .valueChanges({ idField: 'id' })
      .pipe(
        catchError(error => {
          console.error('Error getting users:', error);
          return of([]);
        })
      );
  }
}