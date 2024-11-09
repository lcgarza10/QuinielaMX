import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match } from '../services/football.service';
import { Observable, combineLatest, of, firstValueFrom, interval, Subscription } from 'rxjs';
import { map, switchMap, tap, takeWhile } from 'rxjs/operators';
import { SeasonService } from '../services/season.service';

interface LeaderboardEntry {
  username: string;
  totalPoints: number;
  weeklyPoints?: number;
  livePoints?: number;
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  overallLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  weeklyLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  loading: boolean = true;
  error: string | null = null;
  selectedRound: number = 1;
  selectedView: 'weekly' | 'overall' = 'weekly';
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  currentRound: number = 1;
  isCurrentRoundActive: boolean = false;
  nextRoundStartDate: Date | null = null;
  liveMatches: Match[] = [];
  private liveUpdateSubscription?: Subscription;
  private readonly LIVE_UPDATE_INTERVAL = 30000; // 30 seconds

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private seasonService: SeasonService,
    private footballService: FootballService
  ) {}

  async ngOnInit() {
    await this.findCurrentRound();
    this.loadLeaderboards();
    this.setupLiveUpdates();
  }

  ngOnDestroy() {
    if (this.liveUpdateSubscription) {
      this.liveUpdateSubscription.unsubscribe();
    }
  }

  private setupLiveUpdates() {
    if (this.isCurrentRoundActive && this.selectedRound === this.currentRound) {
      this.liveUpdateSubscription = interval(this.LIVE_UPDATE_INTERVAL)
        .pipe(
          takeWhile(() => this.isCurrentRoundActive)
        )
        .subscribe(() => {
          this.updateLiveScores();
        });
    }
  }

  private async updateLiveScores() {
    try {
      const matches = await firstValueFrom(this.footballService.getMatches(this.currentRound));
      const hasLiveMatches = matches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );

      if (hasLiveMatches) {
        this.liveMatches = matches.filter(match => 
          match.status.short === 'LIVE' || 
          match.status.short === 'HT'
        );
        this.loadLeaderboards(true); // true indicates it's a live update
      } else {
        // No more live matches, stop updates
        this.isCurrentRoundActive = false;
        if (this.liveUpdateSubscription) {
          this.liveUpdateSubscription.unsubscribe();
        }
        // Final update of the leaderboard
        this.loadLeaderboards();
      }
    } catch (error) {
      console.error('Error updating live scores:', error);
    }
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedRound = currentRound;

      const matches = await firstValueFrom(this.footballService.getMatches(currentRound));
      
      this.liveMatches = matches.filter(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );
      
      this.isCurrentRoundActive = this.liveMatches.length > 0;

      if (this.isCurrentRoundActive) {
        this.setupLiveUpdates();
      }

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
      this.selectedRound = 1;
    }
    this.loading = false;
  }

  onViewChange() {
    this.loadLeaderboards();
  }

  onRoundChange(round: number) {
    this.selectedRound = round;
    
    // Stop live updates if switching away from current round
    if (round !== this.currentRound && this.liveUpdateSubscription) {
      this.liveUpdateSubscription.unsubscribe();
    }
    
    // Start live updates if switching to current round with live matches
    if (round === this.currentRound && this.isCurrentRoundActive) {
      this.setupLiveUpdates();
    }
    
    this.loadLeaderboards();
  }

  getRoundStatus(): string {
    if (this.selectedRound === this.currentRound) {
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
    return `Jornada ${this.selectedRound}`;
  }

  loadLeaderboards(isLiveUpdate: boolean = false) {
    if (!isLiveUpdate) {
      this.loading = true;
    }
    this.error = null;

    const users$ = this.databaseService.getAllUsers().pipe(
      tap(users => console.log('Users loaded:', users))
    );

    // Weekly Leaderboard
    this.weeklyLeaderboard$ = users$.pipe(
      switchMap(users => {
        const userPredictions$ = users.map(user => 
          this.databaseService.getPredictions(user.uid, this.selectedRound.toString()).pipe(
            map(predictions => {
              let weeklyPoints = 0;
              
              // Calculate points including live matches
              predictions.forEach(pred => {
                const liveMatch = this.liveMatches.find(m => m.id === pred.matchId);
                if (liveMatch && pred.homeScore !== null && pred.awayScore !== null) {
                  // Calculate live points
                  if (pred.homeScore === liveMatch.homeScore && 
                      pred.awayScore === liveMatch.awayScore) {
                    weeklyPoints += 3;
                  } else {
                    const actualResult = Math.sign(liveMatch.homeScore! - liveMatch.awayScore!);
                    const predictedResult = Math.sign(pred.homeScore - pred.awayScore);
                    if (actualResult === predictedResult) {
                      weeklyPoints += 1;
                    }
                  }
                } else {
                  // Add existing points for non-live matches
                  weeklyPoints += pred.points || 0;
                }
              });

              return {
                username: user.username || user.email || 'Unknown User',
                weeklyPoints,
                totalPoints: 0
              };
            })
          )
        );
        return combineLatest(userPredictions$);
      }),
      map(entries => entries.sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0)))
    );

    // Overall Leaderboard
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
    if (this.selectedView === 'weekly') {
      return leaderboard.length > 0 ? (leaderboard[0].weeklyPoints || 0) : 0;
    }
    return leaderboard.length > 0 ? leaderboard[0].totalPoints : 0;
  }
}