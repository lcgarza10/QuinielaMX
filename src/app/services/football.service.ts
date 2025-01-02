import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { SeasonService } from './season.service';
import { Season } from '../models/season.model';

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

interface RoundsApiResponse {
  response: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FootballService {
  private readonly API_HOST = 'v3.football.api-sports.io';
  private readonly API_URL = `https://${this.API_HOST}`;
  private readonly API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
  private readonly LIGA_MX_ID = '262';
  private readonly TIMEZONE = 'America/Mexico_City';
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private readonly matchesCache = new Map<number, { timestamp: number; matches: Match[] }>();
  private readonly playoffMatchesCache = new Map<string, { timestamp: number; matches: PlayoffMatch[] }>();
  private currentRoundSubject = new BehaviorSubject<number>(1);
  private currentRoundPromise: Promise<number> | null = null;
  private currentSeason: string = '2024';

  constructor(
    private http: HttpClient,
    private seasonService: SeasonService
  ) {
    this.initializeCurrentSeason();
  }

  private initializeCurrentSeason() {
    this.seasonService.getActiveSeason().subscribe(season => {
      if (season) {
        // Extraer el año del nombre de la temporada (ej: "Clausura 2022" -> "2022")
        const year = season.name.split(' ')[1];
        if (year !== this.currentSeason) {
          this.currentSeason = year;
          // Limpiar los caches cuando cambia la temporada
          this.matchesCache.clear();
          this.playoffMatchesCache.clear();
          // Reinicializar la ronda actual
          this.initializeCurrentRound();
        }
      }
    });
  }

  private async initializeCurrentRound() {
    try {
      const round = await this.fetchCurrentRound();
      this.currentRoundSubject.next(round);
    } catch (error) {
      console.error('Error initializing current round:', error);
      this.currentRoundSubject.next(1);
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

    const headers = new HttpHeaders()
      .set('x-rapidapi-host', this.API_HOST)
      .set('x-rapidapi-key', this.API_KEY);

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.currentSeason)
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
    const cacheKey = round || 'all';
    const cachedMatches = this.getCachedPlayoffMatches(cacheKey);
    if (cachedMatches) {
      return of(cachedMatches);
    }

    const headers = new HttpHeaders()
      .set('x-rapidapi-host', this.API_HOST)
      .set('x-rapidapi-key', this.API_KEY);

    const startDate = this.getPlayoffStartDate();
    const endDate = this.getPlayoffEndDate();

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.currentSeason)
      .set('from', startDate)
      .set('to', endDate)
      .set('timezone', this.TIMEZONE)
      .set('status', 'NS-PST-CANC-TBD-1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-LIVE-ALL');

    return this.http.get<ApiResponse>(`${this.API_URL}/fixtures`, { headers, params })
      .pipe(
        map(response => {
          if (!response?.response) {
            console.log('No playoff matches found in response');
            return [];
          }

          console.log('Found playoff matches:', response.response.length);
          console.log('Raw matches data:', response.response.map(fixture => ({
            id: fixture.fixture.id,
            date: fixture.fixture.date,
            status: fixture.fixture.status,
            home: fixture.teams.home.name,
            away: fixture.teams.away.name
          })));
          
          const matches: PlayoffMatch[] = [];

          // Primero agrupamos los partidos por ronda
          const roundMatches = new Map<string, FixtureResponse[]>();
          for (const fixture of response.response) {
            const matchDate = new Date(fixture.fixture.date);
            let round: PlayoffMatch['round'] | undefined;

            if (this.isApertura()) {
              if (matchDate >= new Date(`${this.currentSeason}-11-20`) && matchDate <= new Date(`${this.currentSeason}-11-24`)) {
                round = 'Reclasificación';
              } else if (matchDate >= new Date(`${this.currentSeason}-11-27`) && matchDate <= new Date(`${this.currentSeason}-12-03`)) {
                round = 'Cuartos de Final';
              } else if (matchDate >= new Date(`${this.currentSeason}-12-04`) && matchDate <= new Date(`${this.currentSeason}-12-10`)) {
                round = 'Semifinal';
              } else if (matchDate >= new Date(`${this.currentSeason}-12-11`) && matchDate <= new Date(`${this.currentSeason}-12-20`)) {
                round = 'Final';
              }
            } else {
              if (matchDate >= new Date(`${this.currentSeason}-05-08`) && matchDate <= new Date(`${this.currentSeason}-05-12`)) {
                round = 'Reclasificación';
              } else if (matchDate >= new Date(`${this.currentSeason}-05-15`) && matchDate <= new Date(`${this.currentSeason}-05-21`)) {
                round = 'Cuartos de Final';
              } else if (matchDate >= new Date(`${this.currentSeason}-05-22`) && matchDate <= new Date(`${this.currentSeason}-05-26`)) {
                round = 'Semifinal';
              } else if (matchDate >= new Date(`${this.currentSeason}-05-27`) && matchDate <= new Date(`${this.currentSeason}-05-29`)) {
                round = 'Final';
              }
            }

            if (round) {
              if (!roundMatches.has(round)) {
                roundMatches.set(round, []);
              }
              roundMatches.get(round)?.push(fixture);
            }
          }

          // Ahora procesamos cada ronda, ordenando los partidos por fecha
          for (const [round, fixtures] of roundMatches) {
            // Ordenamos los partidos por fecha
            const sortedFixtures = fixtures.sort((a, b) => 
              new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
            );

            // Asignamos leg basado en el orden cronológico
            sortedFixtures.forEach((fixture, index) => {
              const leg = fixtures.length > 1 ? (index === 0 ? 1 : 2) : undefined;

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
                round: round as PlayoffMatch['round'],
                leg,
                weekNumber: 0
              };

              matches.push(match);
            });
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
      'x-rapidapi-host': this.API_HOST,
      'x-rapidapi-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.currentSeason)
      .set('current', 'true');

    try {
      const response = await firstValueFrom(
        this.http.get<RoundsApiResponse>(`${this.API_URL}/fixtures/rounds`, { headers, params })
      );

      if (response && Array.isArray(response.response) && response.response.length > 0) {
        // Buscar la ronda actual basada en la fecha
        const now = new Date();
        const matchesPromises = response.response.map((round: string) => 
          firstValueFrom(this.getMatches(this.extractWeekNumber(round)))
        );
        
        const allMatches = await Promise.all(matchesPromises);
        
        for (let i = 0; i < allMatches.length; i++) {
          const matches = allMatches[i];
          const roundMatches = matches.filter((match: Match) => {
            const matchDate = new Date(match.date);
            return matchDate >= now;
          });
          
          if (roundMatches.length > 0) {
            return this.extractWeekNumber(response.response[i]);
          }
        }
        
        // Si no encontramos una ronda futura, devolver la última
        return this.extractWeekNumber(response.response[response.response.length - 1]);
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

  private getPlayoffStartDate(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isApertura = currentMonth >= 7;
    const seasonYear = isApertura ? currentYear : currentYear;

    if (isApertura) {
      // Apertura playoff dates (November-December)
      return `${seasonYear}-11-20`;
    } else {
      // Clausura playoff dates (May)
      return `${seasonYear}-05-01`;
    }
  }

  private getPlayoffEndDate(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isApertura = currentMonth >= 7;
    const seasonYear = isApertura ? currentYear : currentYear;

    if (isApertura) {
      // Apertura playoff dates (November-December)
      return `${seasonYear}-12-20`; // Extendido hasta el 20 de diciembre
    } else {
      // Clausura playoff dates (May)
      return `${seasonYear}-05-31`;
    }
  }

  private isApertura(): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    return currentMonth >= 7;
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