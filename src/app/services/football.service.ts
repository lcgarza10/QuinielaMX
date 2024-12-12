import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
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
  extra?: number | null;
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

export interface PlayoffMatch extends Omit<Match, 'round'> {
  round: 'Reclasificación' | 'Cuartos de Final' | 'Semifinal' | 'Final';
  leg?: 1 | 2;
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
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
  
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;

  private readonly matchesCache = new Map<number, { timestamp: number; matches: Match[] }>();
  private readonly playoffMatchesCache = new Map<string, { timestamp: number; matches: PlayoffMatch[] }>();
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
        }),
        shareReplay(1)
      );
  }

  getPlayoffMatches(round?: string): Observable<PlayoffMatch[]> {
    const cacheKey = round || 'playoffs';
    const cachedMatches = this.getCachedPlayoffMatches(cacheKey);
    if (cachedMatches) {
      return of(cachedMatches);
    }

    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isApertura = currentMonth >= 7;
    const seasonYear = isApertura ? currentYear : currentYear;

    let startDate: string;
    let endDate: string;

    if (isApertura) {
      // Apertura playoff dates (November-December)
      startDate = `${seasonYear}-11-20`;
      endDate = `${seasonYear}-12-15`;
    } else {
      // Clausura playoff dates (May)
      startDate = `${seasonYear}-05-01`;
      endDate = `${seasonYear}-05-31`;
    }

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('from', startDate)
      .set('to', endDate)
      .set('timezone', this.TIMEZONE)
      .set('status', 'NS-TBD-1H-HT-2H-FT');

    console.log('Fetching playoff matches with params:', {
      startDate,
      endDate,
      isApertura,
      seasonYear
    });

    return this.http.get<ApiResponse>(`${this.API_URL}/fixtures`, { headers, params })
      .pipe(
        map(response => {
          if (!response?.response) {
            console.log('No playoff matches found in response');
            return [];
          }

          console.log('Found playoff matches:', response.response.length);
          
          const matches: PlayoffMatch[] = [];

          for (const fixture of response.response) {
            const matchDate = new Date(fixture.fixture.date);
            let round: PlayoffMatch['round'] | undefined;
            let leg: 1 | 2 | undefined;

            if (isApertura) {
              // Apertura playoff rounds
              if (matchDate >= new Date(`${seasonYear}-11-20`) && matchDate <= new Date(`${seasonYear}-11-24`)) {
                round = 'Reclasificación';
              } else if (matchDate >= new Date(`${seasonYear}-11-27`) && matchDate <= new Date(`${seasonYear}-12-03`)) {
                round = 'Cuartos de Final';
                leg = matchDate <= new Date(`${seasonYear}-11-30`) ? 1 : 2;
              } else if (matchDate >= new Date(`${seasonYear}-12-04`) && matchDate <= new Date(`${seasonYear}-12-10`)) {
                round = 'Semifinal';
                leg = matchDate <= new Date(`${seasonYear}-12-07`) ? 1 : 2;
              } else if (matchDate >= new Date(`${seasonYear}-12-11`) && matchDate <= new Date(`${seasonYear}-12-15`)) {
                round = 'Final';
                leg = matchDate <= new Date(`${seasonYear}-12-13`) ? 1 : 2;
              }
            } else {
              // Clausura playoff rounds
              if (matchDate >= new Date(`${seasonYear}-05-08`) && matchDate <= new Date(`${seasonYear}-05-12`)) {
                round = 'Reclasificación';
              } else if (matchDate >= new Date(`${seasonYear}-05-15`) && matchDate <= new Date(`${seasonYear}-05-21`)) {
                round = 'Cuartos de Final';
                leg = matchDate <= new Date(`${seasonYear}-05-18`) ? 1 : 2;
              } else if (matchDate >= new Date(`${seasonYear}-05-22`) && matchDate <= new Date(`${seasonYear}-05-26`)) {
                round = 'Semifinal';
                leg = matchDate <= new Date(`${seasonYear}-05-24`) ? 1 : 2;
              } else if (matchDate >= new Date(`${seasonYear}-05-27`) && matchDate <= new Date(`${seasonYear}-05-29`)) {
                round = 'Final';
                leg = matchDate <= new Date(`${seasonYear}-05-28`) ? 1 : 2;
              }
            }

            if (round && (!round || round === round)) {
              console.log('Adding playoff match:', {
                id: fixture.fixture.id,
                date: fixture.fixture.date,
                round,
                leg,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name
              });

              const match: PlayoffMatch = {
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

              matches.push(match);
            }
          }

          const sortedMatches = matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          this.setCachedPlayoffMatches(cacheKey, sortedMatches);
          return sortedMatches;
        }),
        catchError(error => {
          console.error('Error fetching playoff matches:', error);
          return of([]);
        }),
        shareReplay(1)
      );
  }

  async getCurrentPhase(): Promise<string> {
    try {
      // Intentar obtener partidos de la final primero
      const finalMatches = await this.getPlayoffMatches('Final').toPromise();
      if (finalMatches && finalMatches.length > 0) {
        return 'Final';
      }

      // Si no hay final, intentar con semifinal
      const semiMatches = await this.getPlayoffMatches('Semifinal').toPromise();
      if (semiMatches && semiMatches.length > 0) {
        return 'Semifinal';
      }

      // Si no hay semifinales, verificar cuartos
      const quarterMatches = await this.getPlayoffMatches('Cuartos de Final').toPromise();
      if (quarterMatches && quarterMatches.length > 0) {
        return 'Cuartos de Final';
      }

      // Si no hay cuartos, intentar con reclasificación
      const replayMatches = await this.getPlayoffMatches('Reclasificación').toPromise();
      if (replayMatches && replayMatches.length > 0) {
        return 'Reclasificación';
      }

      // Si no hay playoffs, devolver la última jornada regular
      return '17';
    } catch (error) {
      console.error('Error getting current phase:', error);
      return 'Final'; // Default a final si hay error
    }
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

  private getCachedPlayoffMatches(key: string): PlayoffMatch[] | null {
    const cached = this.playoffMatchesCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.playoffMatchesCache.delete(key);
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

  private setCachedPlayoffMatches(key: string, matches: PlayoffMatch[]) {
    this.playoffMatchesCache.set(key, {
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
    return of([18, 19, 20]);
  }
}