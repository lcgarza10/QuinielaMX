import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

export interface Venue {
  id?: number;
  name: string;
  city: string;
}

export interface Status {
  long: string;
  short: string;
  elapsed?: number | null;
}

export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface Goals {
  home: number | null;
  away: number | null;
}

export interface Match {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  homeScore: number | null;
  awayScore: number | null;
  status: Status;
  venue: Venue;
  round: string;
  weekNumber: number;
  homeTeamPosition?: number;
  awayTeamPosition?: number;
  homeTeamForm?: string;
  awayTeamForm?: string;
}

export interface PlayoffMatch extends Match {
  leg?: number;
  prediction?: {
    homeScore: number | null;
    awayScore: number | null;
    points?: number;
    livePoints?: number;
  };
}

interface FixtureResponse {
  fixture: {
    id: number;
    date: string;
    status: Status;
    venue: Venue;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: Goals;
  league: {
    round: string;
  };
}

interface ApiResponse {
  response: FixtureResponse[];
}

@Injectable({
  providedIn: 'root'
})
export class FootballService {
  private readonly API_HOST = 'v3.football.api-sports.io';
  private readonly API_URL = `https://${this.API_HOST}`;
  private readonly API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
  private readonly LIGA_MX_ID = '262';
  private readonly CURRENT_SEASON = '2024';
  private readonly TIMEZONE = 'America/Mexico_City';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;

  private readonly matchesCache = new Map<number, { timestamp: number; matches: Match[] }>();
  private currentRoundSubject = new BehaviorSubject<number>(1);
  private currentRoundPromise: Promise<number> | null = null;

  constructor(private http: HttpClient) {
    this.initializeCurrentRound();
  }

  private async initializeCurrentRound() {
    try {
      const round = await this.fetchCurrentRound();
      this.currentRoundSubject.next(round);
    } catch (error) {
      console.error('Error initializing current round:', error);
    }
  }

  async getCurrentRound(): Promise<number> {
    if (this.currentRoundSubject.value === 1) {
      if (!this.currentRoundPromise) {
        this.currentRoundPromise = this.fetchCurrentRound();
      }
      const round = await this.currentRoundPromise;
      this.currentRoundSubject.next(round);
      this.currentRoundPromise = null;
    }
    return this.currentRoundSubject.value;
  }

  getMatches(round: number): Observable<Match[]> {
    const cachedMatches = this.getCachedMatches(round);
    if (cachedMatches) {
      return of(cachedMatches);
    }

    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('round', this.getRoundString(round))
      .set('timezone', this.TIMEZONE);

    return this.http.get<ApiResponse>(`${this.API_URL}/fixtures`, { headers, params })
      .pipe(
        map(response => {
          if (!response?.response) return [];
          
          const matches = response.response.map(fixture => ({
            id: fixture.fixture.id,
            date: fixture.fixture.date,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            homeTeamLogo: fixture.teams.home.logo,
            awayTeamLogo: fixture.teams.away.logo,
            homeScore: fixture.goals.home,
            awayScore: fixture.goals.away,
            status: fixture.fixture.status,
            venue: fixture.fixture.venue,
            round: fixture.league.round,
            weekNumber: this.extractWeekNumber(fixture.league.round)
          }));

          this.setCachedMatches(round, matches);
          return matches;
        }),
        catchError(error => {
          console.error('Error fetching matches:', error);
          return of([]);
        })
      );
  }

  getPlayoffMatches(): Observable<PlayoffMatch[]> {
    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('from', '2024-11-20')
      .set('to', '2024-12-15')
      .set('timezone', this.TIMEZONE);

    return this.http.get<ApiResponse>(`${this.API_URL}/fixtures`, { headers, params })
      .pipe(
        map(response => {
          if (!response?.response) return [];
          
          return response.response.map(fixture => {
            let round = 'Regular';
            let leg: number | undefined;

            const matchDate = new Date(fixture.fixture.date);
            
            if (matchDate >= new Date('2024-11-20') && matchDate <= new Date('2024-11-24')) {
              round = 'Reclasificación';
            } else if (matchDate >= new Date('2024-11-27') && matchDate <= new Date('2024-12-01')) {
              round = 'Cuartos de Final';
              leg = matchDate <= new Date('2024-11-28') ? 1 : 2;
            } else if (matchDate >= new Date('2024-12-04') && matchDate <= new Date('2024-12-08')) {
              round = 'Semifinal';
              leg = matchDate <= new Date('2024-12-05') ? 1 : 2;
            } else if (matchDate >= new Date('2024-12-12') && matchDate <= new Date('2024-12-15')) {
              round = 'Final';
              leg = matchDate <= new Date('2024-12-12') ? 1 : 2;
            }

            return {
              id: fixture.fixture.id,
              date: fixture.fixture.date,
              homeTeam: fixture.teams.home.name,
              awayTeam: fixture.teams.away.name,
              homeTeamLogo: fixture.teams.home.logo,
              awayTeamLogo: fixture.teams.away.logo,
              homeScore: fixture.goals.home,
              awayScore: fixture.goals.away,
              status: fixture.fixture.status,
              venue: fixture.fixture.venue,
              round,
              leg,
              weekNumber: 0
            };
          });
        }),
        catchError(error => {
          console.error('Error fetching playoff matches:', error);
          return of([]);
        })
      );
  }

  private async fetchCurrentRound(): Promise<number> {
    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('current', 'true');

    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.API_URL}/fixtures/rounds`, { headers, params })
      );

      if (response && Array.isArray(response.response) && response.response.length > 0) {
        const currentRound = response.response[response.response.length - 1];
        const roundNumber = this.extractWeekNumber(currentRound);
        return roundNumber;
      }

      console.warn('Invalid response from rounds API, defaulting to round 1');
      return 1;
    } catch (error) {
      console.error('Error fetching current round:', error);
      return 1;
    }
  }

  private getCachedMatches(round: number): Match[] | null {
    const cached = this.matchesCache.get(round);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.matchesCache.delete(round);
      return null;
    }

    return cached.matches;
  }

  private setCachedMatches(round: number, matches: Match[]) {
    this.matchesCache.set(round, {
      timestamp: Date.now(),
      matches
    });
  }

  private getRoundString(round: number): string {
    return `Apertura - ${round}`;
  }

  private extractWeekNumber(round: string): number {
    const match = round.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 1;
  }

  getOrdinalSuffix(position: number): string {
    if (position === 1) return 'er';
    if (position === 2) return 'do';
    if (position === 3) return 'er';
    return 'to';
  }

  getPlayoffRounds(): Observable<number[]> {
    // Replace with actual API call logic
    return of([18, 19, 20]); // Example playoff rounds
  }
}