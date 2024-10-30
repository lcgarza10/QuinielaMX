import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';

export interface Season {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SeasonService {
  private readonly SEASON_COLLECTION = 'seasons';
  private readonly ACTIVE_SEASON_DOC = 'config/activeSeason';

  constructor(private afs: AngularFirestore) {}

  getActiveSeason(): Observable<Season | null> {
    return this.afs.doc<{ seasonId: string }>(this.ACTIVE_SEASON_DOC).valueChanges().pipe(
      switchMap(config => {
        if (!config?.seasonId) return of(null);
        return this.afs.doc<any>(`${this.SEASON_COLLECTION}/${config.seasonId}`).valueChanges().pipe(
          map(season => {
            if (!season) return null;
            return {
              ...season,
              id: config.seasonId,
              // Convert Firestore Timestamps to JavaScript Dates
              startDate: season.startDate?.toDate() || new Date(),
              endDate: season.endDate?.toDate() || new Date()
            };
          })
        );
      })
    );
  }

  getAllSeasons(): Observable<Season[]> {
    return this.afs.collection<any>(this.SEASON_COLLECTION).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data();
        const id = a.payload.doc.id;
        return {
          ...data,
          id,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        };
      }))
    );
  }

  async createSeason(season: Omit<Season, 'id'>): Promise<string> {
    const seasonRef = this.afs.collection(this.SEASON_COLLECTION).doc();
    await seasonRef.set({
      ...season,
      startDate: firebase.firestore.Timestamp.fromDate(season.startDate),
      endDate: firebase.firestore.Timestamp.fromDate(season.endDate)
    });
    return seasonRef.ref.id;
  }

  async setActiveSeason(seasonId: string): Promise<void> {
    await this.afs.doc(this.ACTIVE_SEASON_DOC).set({ seasonId });
  }

  async updateSeason(seasonId: string, season: Partial<Season>): Promise<void> {
    const updateData: any = { ...season };
    if (season.startDate) {
      updateData.startDate = firebase.firestore.Timestamp.fromDate(season.startDate);
    }
    if (season.endDate) {
      updateData.endDate = firebase.firestore.Timestamp.fromDate(season.endDate);
    }
    await this.afs.doc(`${this.SEASON_COLLECTION}/${seasonId}`).update(updateData);
  }

  async saveSeason(season: Omit<Season, 'id'>): Promise<void> {
    const seasonId = await this.createSeason(season);
    if (season.isActive) {
      await this.setActiveSeason(seasonId);
    }
  }
}