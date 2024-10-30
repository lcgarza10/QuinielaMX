import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, timeout, tap, shareReplay, retryWhen, delay, take } from 'rxjs/operators';

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

export interface FixtureResponse {
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
}

export interface ApiResponse {
  response: FixtureResponse[];
}

interface CacheEntry {
  data: Match[];
  timestamp: number;
  expiresAt: number;
}

interface Cache {
  [key: string]: CacheEntry;
}

@Injectable({
  providedIn: 'root'
})
export class FootballService {
  private readonly API_HOST = 'v3.football.api-sports.io';
  private readonly API_URL = `https://${this.API_HOST}/fixtures`;
  private readonly API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
  private readonly LIGA_MX_ID = '262';
  private readonly CURRENT_SEASON = '2024';
  private readonly TIMEZONE = 'America/Mexico_City';
  
  // Cache durations
  private readonly STANDARD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  
  // Rate limiting
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private readonly RATE_LIMIT_COOLDOWN = 60 * 60 * 1000; // 1 hour

  private cache: Cache = {};
  private requestsInProgress: { [key: string]: Observable<Match[]> } = {};
  private lastRateLimitHit: number = 0;

  constructor(private http: HttpClient) {
    this.loadCacheFromStorage();
    window.addEventListener('beforeunload', () => this.saveCacheToStorage());
  }

  private loadCacheFromStorage(): void {
    try {
      const savedCache = localStorage.getItem('footballMatchesCache');
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        if (this.isValidCache(parsed)) {
          const now = Date.now();
          Object.keys(parsed).forEach(key => {
            if (now > parsed[key].expiresAt) {
              delete parsed[key];
            }
          });
          this.cache = parsed;
        } else {
          this.clearCache();
        }
      }
    } catch (error) {
      console.warn('Error loading cache:', error);
      this.clearCache();
    }
  }

  private isValidCache(cache: any): cache is Cache {
    if (typeof cache !== 'object' || cache === null) return false;
    
    for (const key in cache) {
      const entry = cache[key];
      if (!entry || typeof entry !== 'object') return false;
      if (!Array.isArray(entry.data)) return false;
      if (typeof entry.timestamp !== 'number') return false;
      if (typeof entry.expiresAt !== 'number') return false;
    }
    
    return true;
  }

  private saveCacheToStorage(): void {
    try {
      localStorage.setItem('footballMatchesCache', JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Error saving cache:', error);
    }
  }

  private getRoundString(round: number): string {
    return `Apertura - ${round}`;
  }

  private extractWeekNumber(round: string): number {
    const match = round.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 1;
  }

  getMatches(round: number): Observable<Match[]> {
    const cacheKey = `round-${round}`;
    const now = Date.now();

    // Check if we're in a rate limit cooldown
    const isInRateLimitCooldown = now - this.lastRateLimitHit < this.RATE_LIMIT_COOLDOWN;
    
    // Check cache
    const cachedData = this.cache[cacheKey];
    if (cachedData && now < cachedData.expiresAt) {
      console.log('Returning valid cached data');
      return of(cachedData.data);
    }

    // Return existing request if one is in progress
    if (this.requestsInProgress[cacheKey]) {
      console.log('Returning in-progress request');
      return this.requestsInProgress[cacheKey];
    }

    // If in rate limit cooldown and we have any cached data, return it
    if (isInRateLimitCooldown && cachedData) {
      console.log('Rate limit cooldown active, returning cached data');
      return of(cachedData.data);
    }

    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('round', this.getRoundString(round))
      .set('timezone', this.TIMEZONE);

    this.requestsInProgress[cacheKey] = this.http.get<ApiResponse>(this.API_URL, { headers, params }).pipe(
      timeout(10000),
      map(response => {
        if (!response || !response.response || !Array.isArray(response.response)) {
          throw new Error('Invalid API response format');
        }
        
        return response.response.map((fixture: FixtureResponse) => ({
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
      }),
      tap(matches => {
        // Update cache with appropriate expiration
        const cacheDuration = isInRateLimitCooldown ? 
          this.RATE_LIMIT_CACHE_DURATION : 
          this.STANDARD_CACHE_DURATION;

        this.cache[cacheKey] = {
          data: matches,
          timestamp: now,
          expiresAt: now + cacheDuration
        };
        this.saveCacheToStorage();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('API Error:', error);
        
        if (error.error?.code === 2100) {
          console.warn('API rate limit exceeded');
          this.lastRateLimitHit = now;
          
          if (cachedData) {
            // Extend cache validity during rate limit
            cachedData.expiresAt = now + this.RATE_LIMIT_CACHE_DURATION;
            this.saveCacheToStorage();
            return of(cachedData.data);
          }
        }
        
        if (cachedData) {
          return of(cachedData.data);
        }

        return throwError(() => error);
      }),
      retryWhen(errors => 
        errors.pipe(
          delay(this.RETRY_DELAY),
          take(this.MAX_RETRIES)
        )
      ),
      tap(() => {
        delete this.requestsInProgress[cacheKey];
      }),
      shareReplay(1)
    );

    return this.requestsInProgress[cacheKey];
  }

  clearCache(): void {
    this.cache = {};
    this.requestsInProgress = {};
    localStorage.removeItem('footballMatchesCache');
  }
}