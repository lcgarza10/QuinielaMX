import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from '@firebase/app-compat';
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
}

export interface UserPredictions {
  userId: string;
  weeklyPredictions: { [week: string]: PredictionDocument };
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private isOnline: boolean = true;

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

  getAllUsers(): Observable<User[]> {
    return this.firebaseRetryService.retryOperation(
      this.afs.collection<User>('users').valueChanges()
    ).pipe(
      tap(users => console.log('Users fetched from Firestore:', users)),
      catchError(error => {
        console.error('Error getting users:', error);
        return of([]);
      })
    );
  }

  getUserTotalPoints(userId: string): Observable<number> {
    return this.afs.collection(`predictions/${userId}/weeks`).valueChanges()
      .pipe(
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

  getPredictions(userId: string, week: string): Observable<Prediction[]> {
    return this.firebaseRetryService.retryOperation(
      this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`).valueChanges()
    ).pipe(
      map(doc => doc?.predictions || []),
      catchError(error => {
        console.error('Error getting predictions:', error);
        return of([]);
      })
    );
  }

  savePredictions(userId: string, week: string, predictions: Prediction[], totalPoints: number): Observable<void> {
    if (!this.isOnline) {
      console.warn('Offline: Predictions will be saved when back online');
      return of(undefined);
    }
    return this.firebaseRetryService.retryOperation(
      from(this.afs.doc(`predictions/${userId}/weeks/${week}`).set({ predictions, totalPoints }, { merge: true }))
    ).pipe(
      tap(() => console.log('Predictions saved successfully')),
      catchError(error => {
        console.error('Error saving predictions:', error);
        return throwError(() => new Error('Failed to save predictions. Please try again later.'));
      })
    );
  }

  async clearAllPredictions(): Promise<void> {
    try {
      const users = await firstValueFrom(this.getAllUsers());
      const batch = this.afs.firestore.batch();
      
      for (const user of users) {
        const predictionsRef = this.afs.collection(`predictions/${user.uid}/weeks`);
        const docs = await predictionsRef.ref.get();
        
        docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      await batch.commit();
      console.log('All predictions cleared successfully');
    } catch (error) {
      console.error('Error clearing predictions:', error);
      throw error;
    }
  }

  async insertTestPredictions(): Promise<void> {
    try {
      const usersSnapshot = await this.afs.collection('users').get().toPromise();
      if (!usersSnapshot) {
        throw new Error('No users found');
      }

      const userIds = usersSnapshot.docs.map(doc => doc.id);
      if (userIds.length === 0) {
        throw new Error('No registered users');
      }

      let documentsProcessed = 0;
      let currentBatch = this.afs.firestore.batch();

      for (const userId of userIds) {
        for (let round = 1; round <= 17; round++) {
          try {
            const matches = await firstValueFrom(this.footballService.getMatches(round));
            
            const completedMatches = matches.filter(match => 
              match.status.short === 'FT' || 
              match.status.short === 'AET' || 
              match.status.short === 'PEN'
            );

            if (completedMatches.length > 0) {
              const predictions: Prediction[] = completedMatches.map(match => {
                const actualHome = match.homeScore || 0;
                const actualAway = match.awayScore || 0;
                const variance = Math.floor(Math.random() * 2);
                
                return {
                  matchId: match.id,
                  homeScore: Math.max(0, actualHome + (Math.random() > 0.5 ? variance : -variance)),
                  awayScore: Math.max(0, actualAway + (Math.random() > 0.5 ? variance : -variance)),
                  points: Math.floor(Math.random() * 4)
                };
              });

              const totalPoints = predictions.reduce((sum, pred) => sum + (pred.points || 0), 0);

              const docRef = this.afs.doc(`predictions/${userId}/weeks/${round}`).ref;
              currentBatch.set(docRef, { predictions, totalPoints });
              documentsProcessed++;

              if (documentsProcessed >= 450) {
                await currentBatch.commit();
                currentBatch = this.afs.firestore.batch();
                documentsProcessed = 0;
              }
            }
          } catch (error) {
            console.error(`Error processing round ${round}:`, error);
            continue;
          }
        }
      }

      if (documentsProcessed > 0) {
        await currentBatch.commit();
      }

    } catch (error) {
      console.error('Error inserting test predictions:', error);
      throw error;
    }
  }

  async resetAllUserPasswords(newPassword: string): Promise<void> {
    try {
      const usersSnapshot = await this.afs.collection('users').get().toPromise();
      if (!usersSnapshot) return;

      const batch = this.afs.firestore.batch();

      usersSnapshot.forEach(doc => {
        batch.update(doc.ref, { passwordHash: this.hashPassword(newPassword) });
      });

      await batch.commit();
      console.log('All user passwords reset successfully');
    } catch (error) {
      console.error('Error resetting passwords:', error);
      throw error;
    }
  }

  async fixWeekNumbers(): Promise<void> {
    try {
      const predictionsSnapshot = await this.afs.collection('predictions').get().toPromise();
      
      if (!predictionsSnapshot) return;

      let documentsProcessed = 0;
      let currentBatch = this.afs.firestore.batch();

      for (const predictionDoc of predictionsSnapshot.docs) {
        const userId = predictionDoc.id;
        const weeksSnapshot = await this.afs.collection(`predictions/${userId}/weeks`).get().toPromise();
        
        if (!weeksSnapshot) continue;

        for (const weekDoc of weeksSnapshot.docs) {
          const oldWeekNumber = parseInt(weekDoc.id);
          if (isNaN(oldWeekNumber)) continue;

          const newWeekNumber = Math.max(1, oldWeekNumber - 25);
          
          if (newWeekNumber === oldWeekNumber) continue;

          const predictionData = weekDoc.data();
          const newWeekRef = this.afs.doc(`predictions/${userId}/weeks/${newWeekNumber}`).ref;
          currentBatch.set(newWeekRef, predictionData);
          currentBatch.delete(weekDoc.ref);

          documentsProcessed++;

          if (documentsProcessed >= 450) {
            await currentBatch.commit();
            currentBatch = this.afs.firestore.batch();
            documentsProcessed = 0;
          }
        }
      }

      if (documentsProcessed > 0) {
        await currentBatch.commit();
      }
    } catch (error) {
      console.error('Error fixing week numbers:', error);
      throw error;
    }
  }

  private hashPassword(password: string): string {
    return btoa(password);
  }
}