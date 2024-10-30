import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match } from '../services/football.service';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { SeasonService } from '../services/season.service';

interface LeaderboardEntry {
  username: string;
  totalPoints: number;
  weeklyPoints?: number;
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  overallLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  weeklyLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  loading: boolean = true;
  error: string | null = null;
  selectedWeek: number = 1;
  selectedView: 'weekly' | 'overall' = 'weekly';
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  lastActiveRound: number = 1;
  isCurrentRoundActive: boolean = false;

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private seasonService: SeasonService,
    private footballService: FootballService
  ) {}

  async ngOnInit() {
    await this.findLastActiveRound();
    this.loadLeaderboards();
  }

  private async findLastActiveRound() {
    this.loading = true;
    try {
      // Start from the current round and go backwards
      for (let round = this.rounds.length; round > 0; round--) {
        const matches = await firstValueFrom(this.footballService.getMatches(round));
        const completedMatches = matches.filter(match => 
          match.status.short === 'FT' || 
          match.status.short === 'AET' || 
          match.status.short === 'PEN'
        );
        
        const activeMatches = matches.filter(match => 
          match.status.short === 'LIVE' || 
          match.status.short === 'HT'
        );

        if (completedMatches.length > 0 || activeMatches.length > 0) {
          this.lastActiveRound = round;
          this.isCurrentRoundActive = activeMatches.length > 0;
          this.selectedWeek = round;
          break;
        }
      }
    } catch (error) {
      console.error('Error finding last active round:', error);
      // Default to round 1 if there's an error
      this.lastActiveRound = 1;
      this.selectedWeek = 1;
    }
    this.loading = false;
  }

  onViewChange() {
    this.loadLeaderboards();
  }

  async onRoundChange() {
    await this.loadLeaderboards();
  }

  getRoundStatus(): string {
    if (this.selectedWeek === this.lastActiveRound) {
      return this.isCurrentRoundActive ? 
        'Jornada actual en curso' : 
        'Última jornada completada';
    }
    return `Jornada ${this.selectedWeek}`;
  }

  loadLeaderboards() {
    this.loading = true;
    this.error = null;

    // Get all users
    const users$ = this.databaseService.getAllUsers().pipe(
      tap(users => console.log('Users loaded:', users))
    );

    // Weekly leaderboard
    const weeklyPredictions$ = users$.pipe(
      switchMap(users => {
        const userPredictions$ = users.map(user => 
          this.databaseService.getPredictions(user.uid, this.selectedWeek.toString()).pipe(
            map(predictions => ({
              username: user.username || user.email || 'Unknown User',
              predictions
            }))
          )
        );
        return combineLatest(userPredictions$);
      })
    );

    // Overall leaderboard
    this.overallLeaderboard$ = users$.pipe(
      switchMap(users => {
        const userPoints$ = users.map(user =>
          this.databaseService.getUserTotalPoints(user.uid).pipe(
            map(totalPoints => ({
              username: user.username || user.email || 'Unknown User',
              totalPoints
            }))
          )
        );
        return combineLatest(userPoints$);
      }),
      map(entries => entries.sort((a, b) => b.totalPoints - a.totalPoints))
    );

    // Weekly leaderboard
    this.weeklyLeaderboard$ = weeklyPredictions$.pipe(
      map(predictions => {
        return predictions
          .map(p => ({
            username: p.username,
            weeklyPoints: this.calculateWeeklyPoints(p.predictions),
            totalPoints: 0 // Not used for weekly view
          }))
          .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
      })
    );

    // Subscribe to handle loading state
    combineLatest([this.overallLeaderboard$, this.weeklyLeaderboard$]).subscribe({
      next: ([overall, weekly]) => {
        console.log('Leaderboards loaded:', { overall, weekly });
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading leaderboard:', err);
        this.loading = false;
        this.error = 'Error al cargar la tabla general. Por favor intente nuevamente.';
      }
    });
  }

  getLeaderPoints(leaderboard: LeaderboardEntry[]): number {
    return leaderboard.length > 0 ? leaderboard[0].totalPoints : 0;
  }

  private calculateWeeklyPoints(predictions: any[]): number {
    return predictions.reduce((total, pred) => total + (pred.points || 0), 0);
  }
}