import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, timeout, tap, shareReplay, retryWhen, delay, take } from 'rxjs/operators';
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
  
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;

  constructor(private http: HttpClient) {}

  async getCurrentRound(): Promise<number> {
    try {
      const now = new Date();
      let currentRound = 1;
      
      // Get all matches for all rounds
      const allMatches: Match[] = [];
      for (let round = 1; round <= 17; round++) {
        const matches = await firstValueFrom(this.getMatches(round));
        allMatches.push(...matches);
      }

      // Sort all matches by date
      const sortedMatches = allMatches.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Find the round that contains matches closest to current date
      let closestMatch: Match | null = null;
      let minTimeDiff = Infinity;
      let roundHasStarted = false;

      for (const match of sortedMatches) {
        const matchDate = new Date(match.date);
        const timeDiff = matchDate.getTime() - now.getTime();
        
        // If match is live or in progress, return its round immediately
        if (match.status.short === 'LIVE' || match.status.short === 'HT') {
          return this.extractWeekNumber(match.round);
        }

        // Update closest match if this one is closer to current time
        if (Math.abs(timeDiff) < minTimeDiff) {
          minTimeDiff = Math.abs(timeDiff);
          closestMatch = match;
        }
      }

      if (closestMatch) {
        const closestMatchDate = new Date(closestMatch.date);
        const roundNumber = this.extractWeekNumber(closestMatch.round);
        
        // Check if any match in the current round has started
        const currentRoundMatches = sortedMatches.filter(m => 
          this.extractWeekNumber(m.round) === roundNumber
        );
        
        roundHasStarted = currentRoundMatches.some(match => 
          new Date(match.date) <= now
        );

        // If the round hasn't started yet, return the previous round
        if (!roundHasStarted && roundNumber > 1) {
          return roundNumber - 1;
        }
        
        return roundNumber;
      }

      return currentRound;
    } catch (error) {
      console.error('Error determining current round:', error);
      return 1;
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
    const headers = new HttpHeaders({
      'x-apisports-key': this.API_KEY
    });

    const params = new HttpParams()
      .set('league', this.LIGA_MX_ID)
      .set('season', this.CURRENT_SEASON)
      .set('round', this.getRoundString(round))
      .set('timezone', this.TIMEZONE);

    return this.http.get<ApiResponse>(this.API_URL, { headers, params }).pipe(
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
      retryWhen(errors => 
        errors.pipe(
          delay(this.RETRY_DELAY),
          take(this.MAX_RETRIES)
        )
      ),
      shareReplay(1)
    );
  }
}