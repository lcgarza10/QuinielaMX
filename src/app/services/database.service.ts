import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentData, QuerySnapshot, DocumentSnapshot } from '@angular/fire/compat/firestore';
import { Observable, of, from, firstValueFrom } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { FootballService, Match } from './football.service';
import { User } from './auth.service';
import { FieldPath } from '@firebase/firestore';

export interface Prediction {
  matchId: number;
  homeScore: number | null;
  awayScore: number | null;
  points?: number;
}

export interface PredictionDocument {
  predictions: Prediction[];
  totalPoints: number;
  lastUpdated: Date;
}

interface UserPoints {
  totalPoints: number;
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
    if (!userId || !week) {
      console.warn('Missing required parameters for getPredictions');
      return of([]);
    }

    return this.afs.doc<PredictionDocument>(`predictions/${userId}/weeks/${week}`)
      .get()
      .pipe(
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
    if (!userId || !week) {
      throw new Error('Missing required parameters for savePredictions');
    }

    try {
      const docRef = this.afs.doc(`predictions/${userId}/weeks/${week}`);
      const data: PredictionDocument = {
        predictions,
        totalPoints,
        lastUpdated: new Date()
      };

      await docRef.set(data, { merge: true });
      await this.updateUserTotalPoints(userId);
    } catch (error) {
      console.error('Error saving predictions:', error);
      throw error;
    }
  }

  getAllUsers(): Observable<User[]> {
    return this.afs.collection<User>('users')
      .get()
      .pipe(
        map(snapshot => {
          const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              uid: doc.id
            } as User;
          });
          console.debug('Fetched users from Firestore:', users.length);
          console.debug('User details:', users.map(user => ({ uid: user.uid, email: user.email })));
          return users;
        }),
        catchError(error => {
          console.error('Error fetching users:', error);
          return of([]);
        })
      );
  }

  getUsersByIds(userIds: string[]): Observable<User[]> {
    if (!userIds || userIds.length === 0) {
      return of([]);
    }

    // Firebase has a limit of 10 'in' clauses, so we need to batch
    const batchSize = 10;
    const batches: Observable<User[]>[] = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchQuery = this.afs.collection<User>('users', ref => 
        ref.where('__name__', 'in', batch)
      ).get().pipe(
        map(snapshot => 
          snapshot.docs.map(doc => ({
            ...doc.data(),
            uid: doc.id
          } as User))
        )
      );
      batches.push(batchQuery);
    }

    return from(Promise.all(batches.map(batch => firstValueFrom(batch)))).pipe(
      map(batchResults => {
        const users = batchResults.flat();
        console.debug('Fetched users by IDs:', users.length);
        return users;
      }),
      catchError(error => {
        console.error('Error fetching users by IDs:', error);
        return of([]);
      })
    );
  }

  getAllUsersTotalPoints(): Observable<{ userId: string; totalPoints: number }[]> {
    return this.afs.collection<UserPoints>('userPoints')
      .get()
      .pipe(
        map(snapshot => {
          if (!snapshot) return [];
          return snapshot.docs.map(doc => ({
            userId: doc.id,
            totalPoints: doc.data()['totalPoints'] || 0
          }));
        }),
        catchError(error => {
          console.error('Error getting all users total points:', error);
          return of([]);
        })
      );
  }

  private async updateUserTotalPoints(userId: string): Promise<void> {
    if (!userId) {
      console.warn('Missing userId for updateUserTotalPoints');
      return;
    }

    try {
      const weeksSnapshot = await this.afs.collection(`predictions/${userId}/weeks`)
        .get()
        .toPromise();
      
      let totalPoints = 0;
      
      if (weeksSnapshot) {
        const currentRound = await this.footballService.getCurrentRound();
        
        for (const doc of weeksSnapshot.docs) {
          const weekData = doc.data() as PredictionDocument;
          const weekNumber = parseInt(doc.id);
          
          if (weekNumber <= currentRound || doc.id === 'playoffs') {
            const matches = doc.id === 'playoffs' 
              ? await firstValueFrom(this.footballService.getPlayoffMatches())
              : await firstValueFrom(this.footballService.getMatches(weekNumber));

            let weekPoints = 0;

            weekData.predictions.forEach(pred => {
              const match = matches.find((match: Match) => match.id === pred.matchId);
              if (match && pred.homeScore !== null && pred.awayScore !== null &&
                  match.homeScore !== null && match.awayScore !== null) {
                
                const predictedResult = Math.sign(pred.homeScore - pred.awayScore);
                const actualResult = Math.sign(match.homeScore - match.awayScore);
                const isExactMatch = pred.homeScore === match.homeScore && 
                                   pred.awayScore === match.awayScore;
                const isPartialMatch = predictedResult === actualResult;

                if (match.status.short === 'FT') {
                  if (isExactMatch) {
                    weekPoints += 3;
                  } else if (isPartialMatch) {
                    weekPoints += 1;
                  }
                }
              }
            });

            totalPoints += weekPoints;
          }
        }
      }

      await this.afs.doc(`userPoints/${userId}`).set({
        totalPoints,
        lastUpdated: new Date()
      }, { merge: true });

    } catch (error) {
      console.error('Error updating total points:', error);
      throw error;
    }
  }

  async updateMatchPoints(userId: string, week: string): Promise<void> {
    if (!userId || !week) {
      console.warn('Missing required parameters for updateMatchPoints');
      return;
    }

    try {
      const [predictionsResult, matchesResult] = await Promise.all([
        firstValueFrom(this.getPredictions(userId, week)),
        week === 'playoffs' 
          ? firstValueFrom(this.footballService.getPlayoffMatches())
          : firstValueFrom(this.footballService.getMatches(parseInt(week)))
      ]);

      if (!predictionsResult || !matchesResult) {
        return;
      }

      let weeklyPoints = 0;
      let updatedPredictions = false;

      const updatedPreds = predictionsResult.map(pred => {
        const match = matchesResult.find((match: Match) => match.id === pred.matchId);
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
          lastUpdated: new Date()
        });

        await batch.commit();
        await this.updateUserTotalPoints(userId);
      }
    } catch (error) {
      console.error('Error updating match points:', error);
    }
  }

  private calculateMatchPoints(prediction: Prediction, match: Match): number {
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    const actualResult = Math.sign(match.homeScore - match.awayScore);
    const isExactMatch = prediction.homeScore === match.homeScore && 
                        prediction.awayScore === match.awayScore;
    const isPartialMatch = predictedResult === actualResult;

    if (isExactMatch) {
      return 3;
    } else if (isPartialMatch) {
      return 1;
    }

    return 0;
  }
}