import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of, from, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import { FootballService, Match } from './football.service';
import { User } from './auth.service';

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
  constructor(
    private afs: AngularFirestore,
    private footballService: FootballService
  ) {}

  getPredictions(userId: string, week: string): Observable<Prediction[]> {
    return this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`)
      .valueChanges()
      .pipe(
        map(doc => doc?.predictions || []),
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
    const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`);
    await docRef.set({
      predictions,
      totalPoints,
      lastUpdated: firebase.firestore.Timestamp.now()
    }, { merge: true });
  }

  getAllUsers(): Observable<User[]> {
    return this.afs.collection<User>('users')
      .valueChanges({ idField: 'uid' })
      .pipe(
        catchError(error => {
          console.error('Error getting users:', error);
          return of([]);
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

  async updateMatchPoints(userId: string, week: string): Promise<void> {
    try {
      const [predictionsResult, matchesResult] = await Promise.all([
        firstValueFrom(this.getPredictions(userId, week)),
        firstValueFrom(this.footballService.getMatches(parseInt(week)))
      ]);

      if (!predictionsResult || !matchesResult) {
        return;
      }

      let weeklyPoints = 0;
      let updatedPredictions = false;

      const updatedPreds = predictionsResult.map((pred: Prediction) => {
        const match = matchesResult.find((m: Match) => m.id === pred.matchId);
        let points = pred.points || 0;

        if (match?.status.short === 'FT' && match.homeScore !== null && match.awayScore !== null) {
          const newPoints = this.calculateMatchPoints(pred, match);
          if (newPoints !== points) {
            points = newPoints;
            updatedPredictions = true;
          }
        }

        weeklyPoints += points;
        return { ...pred, points };
      });

      if (updatedPredictions) {
        const batch = this.afs.firestore.batch();
        
        const weekRef = this.afs.doc(`predictions/${userId}/weeks/${week}`).ref;
        batch.update(weekRef, {
          predictions: updatedPreds,
          totalPoints: weeklyPoints,
          lastUpdated: firebase.firestore.Timestamp.now()
        });

        const userPointsRef = this.afs.doc(`userPoints/${userId}`).ref;
        const totalPoints = await this.calculateTotalPoints(userId);
        batch.update(userPointsRef, {
          totalPoints,
          lastUpdated: firebase.firestore.Timestamp.now()
        });

        await batch.commit();
      }
    } catch (error) {
      console.error('Error updating match points:', error);
    }
  }

  private async calculateTotalPoints(userId: string): Promise<number> {
    const snapshot = await this.afs.collection(`predictions/${userId}/weeks`)
      .get()
      .toPromise();
    
    return snapshot?.docs.reduce((total, doc) => {
      const data = doc.data() as PredictionDocument;
      return total + (data.totalPoints || 0);
    }, 0) || 0;
  }

  private calculateMatchPoints(prediction: Prediction, match: Match): number {
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      return 3;
    }

    const actualResult = Math.sign(match.homeScore - match.awayScore);
    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    if (actualResult === predictedResult) {
      return 1;
    }

    return 0;
  }
}