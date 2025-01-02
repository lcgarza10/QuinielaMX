import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

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
    return this.afs.doc(this.ACTIVE_SEASON_DOC).valueChanges().pipe(
      switchMap((config: any) => {
        if (!config?.seasonId) {
          return of(null);
        }
        return this.afs.doc<any>(`${this.SEASON_COLLECTION}/${config.seasonId}`).valueChanges();
      }),
      map(data => {
        if (!data) return null;
        const { id, ...rest } = data;
        return {
          ...rest,
          id,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate)
        };
      })
    );
  }

  getAllSeasons(): Observable<Season[]> {
    return this.afs.collection<any>(this.SEASON_COLLECTION).valueChanges({ idField: 'id' }).pipe(
      map(seasons => seasons.map(season => ({
        ...season,
        startDate: new Date(season.startDate),
        endDate: new Date(season.endDate)
      })))
    );
  }

  async createSeason(season: Omit<Season, 'id'>): Promise<string> {
    try {
      const seasonRef = this.afs.collection(this.SEASON_COLLECTION).doc();
      const startDate = season.startDate instanceof Date ? season.startDate : new Date(season.startDate);
      const endDate = season.endDate instanceof Date ? season.endDate : new Date(season.endDate);
      
      const data = {
        name: season.name,
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        isActive: season.isActive
      };

      await seasonRef.set(data);
      return seasonRef.ref.id;
    } catch (error) {
      console.error('Error creating season:', error);
      throw error;
    }
  }

  async setActiveSeason(seasonId: string): Promise<void> {
    await this.afs.doc(this.ACTIVE_SEASON_DOC).set({ seasonId });
  }

  async updateSeason(seasonId: string, season: Partial<Season>): Promise<void> {
    try {
      const updateData: any = { ...season };
      if (season.startDate) {
        const startDate = season.startDate instanceof Date ? season.startDate : new Date(season.startDate);
        updateData.startDate = startDate.getTime();
      }
      if (season.endDate) {
        const endDate = season.endDate instanceof Date ? season.endDate : new Date(season.endDate);
        updateData.endDate = endDate.getTime();
      }
      await this.afs.doc(`${this.SEASON_COLLECTION}/${seasonId}`).update(updateData);
    } catch (error) {
      console.error('Error updating season:', error);
      throw error;
    }
  }

  async saveSeason(season: Omit<Season, 'id'>): Promise<void> {
    try {
      const seasonId = await this.createSeason(season);
      if (season.isActive) {
        await this.setActiveSeason(seasonId);
      }
    } catch (error) {
      console.error('Error saving season:', error);
      throw error;
    }
  }
}