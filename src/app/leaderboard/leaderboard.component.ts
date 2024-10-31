import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService } from '../services/football.service';
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
  firstHalfRounds: number[] = [];
  secondHalfRounds: number[] = [];
  currentRound: number = 1;
  isCurrentRoundActive: boolean = false;
  nextRoundStartDate: Date | null = null;

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private seasonService: SeasonService,
    private footballService: FootballService
  ) {
    // Split rounds into two arrays for the grid
    const midPoint = Math.ceil(this.rounds.length / 2);
    this.firstHalfRounds = this.rounds.slice(0, midPoint);
    this.secondHalfRounds = this.rounds.slice(midPoint);
  }

  async ngOnInit() {
    await this.findCurrentRound();
    this.loadLeaderboards();
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedWeek = currentRound;

      // Get matches for the current round to determine its status
      const matches = await firstValueFrom(this.footballService.getMatches(currentRound));
      
      this.isCurrentRoundActive = matches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );

      // Find the next round's start date if applicable
      const nextRoundMatches = await firstValueFrom(this.footballService.getMatches(currentRound + 1));
      if (nextRoundMatches.length > 0) {
        const sortedMatches = nextRoundMatches.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        this.nextRoundStartDate = new Date(sortedMatches[0].date);
      }

    } catch (error) {
      console.error('Error finding current round:', error);
      this.currentRound = 1;
      this.selectedWeek = 1;
    }
    this.loading = false;
  }

  onViewChange() {
    this.loadLeaderboards();
  }

  onRoundChange(round: number) {
    this.selectedWeek = round;
    this.loadLeaderboards();
  }

  getRoundStatus(): string {
    if (this.selectedWeek === this.currentRound) {
      if (this.isCurrentRoundActive) {
        return 'Jornada actual en curso';
      }
      if (this.nextRoundStartDate) {
        const now = new Date();
        const isToday = this.nextRoundStartDate.getDate() === now.getDate() &&
                       this.nextRoundStartDate.getMonth() === now.getMonth() &&
                       this.nextRoundStartDate.getFullYear() === now.getFullYear();
        
        if (isToday) {
          return 'Nueva jornada comienza hoy';
        }
      }
      return 'Última jornada completada';
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