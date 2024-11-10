import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match } from '../services/football.service';
import { GroupService } from '../services/group.service';
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
  globalLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  loading: boolean = true;
  error: string | null = null;
  selectedRound: number = 1;
  selectedView: 'weekly' | 'overall' | 'global' = 'weekly';
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  currentRound: number = 1;
  isCurrentRoundActive: boolean = false;
  nextRoundStartDate: Date | null = null;
  liveMatches: Match[] = [];
  currentUserId: string | null = null;
  currentGroupId: string | null = null;
  private liveUpdateSubscription?: Subscription;
  private readonly LIVE_UPDATE_INTERVAL = 30000; // 30 seconds

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private seasonService: SeasonService,
    private footballService: FootballService,
    private groupService: GroupService
  ) {}

  async ngOnInit() {
    await this.findCurrentRound();
    this.setupUserAndGroup();
  }

  ngOnDestroy() {
    if (this.liveUpdateSubscription) {
      this.liveUpdateSubscription.unsubscribe();
    }
  }

  private async setupUserAndGroup() {
    this.authService.user$.subscribe(async user => {
      if (user) {
        this.currentUserId = user.uid;
        // Get user's first group
        const groups = await firstValueFrom(this.groupService.getUserGroups());
        if (groups.length > 0) {
          this.currentGroupId = groups[0].id || null;
        }
        this.loadLeaderboards();
      }
    });
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
        this.loadLeaderboards(true);
      } else {
        this.isCurrentRoundActive = false;
        if (this.liveUpdateSubscription) {
          this.liveUpdateSubscription.unsubscribe();
        }
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
      
      // Check if all matches are finished
      const finishedMatches = matches.filter(match => 
        match.status.short === 'FT' || 
        match.status.short === 'AET' || 
        match.status.short === 'PEN'
      );

      // Check if any match is live or scheduled for today
      const now = new Date();
      const todayMatches = matches.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate.toDateString() === now.toDateString();
      });

      const liveMatches = matches.filter(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT' ||
        match.status.short === '1H' ||
        match.status.short === '2H'
      );

      this.isCurrentRoundActive = liveMatches.length > 0 || 
                                 (todayMatches.length > 0 && finishedMatches.length < matches.length);
      
      this.liveMatches = liveMatches;
      
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
    
    if (round !== this.currentRound && this.liveUpdateSubscription) {
      this.liveUpdateSubscription.unsubscribe();
    }
    
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
      return 'Jornada actual';
    }
    return `Jornada ${this.selectedRound}`;
  }

  loadLeaderboards(isLiveUpdate: boolean = false) {
    if (!isLiveUpdate) {
      this.loading = true;
    }
    this.error = null;

    if (!this.currentGroupId && this.selectedView !== 'global') {
      this.error = 'No perteneces a ningún grupo';
      this.loading = false;
      return;
    }

    // Get group members if viewing group leaderboards
    const users$ = this.selectedView === 'global' 
      ? this.databaseService.getAllUsers()
      : this.groupService.getGroupMembers(this.currentGroupId!);

    // Weekly Leaderboard (Group or Global)
    this.weeklyLeaderboard$ = users$.pipe(
      switchMap(users => {
        const userPredictions$ = users.map(user => 
          this.databaseService.getPredictions(user.uid, this.selectedRound.toString()).pipe(
            map(predictions => {
              let weeklyPoints = 0;
              
              predictions.forEach(pred => {
                const liveMatch = this.liveMatches.find(m => m.id === pred.matchId);
                if (liveMatch && pred.homeScore !== null && pred.awayScore !== null) {
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

    // Overall Leaderboard (Group)
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

    // Global Leaderboard
    if (this.selectedView === 'global') {
      this.globalLeaderboard$ = this.databaseService.getAllUsersTotalPoints().pipe(
        switchMap(points => {
          const userDetails$ = points.map(point =>
            this.databaseService.getAllUsers().pipe(
              map(users => {
                const user = users.find(u => u.uid === point.userId);
                return {
                  username: user?.username || user?.email || 'Unknown User',
                  totalPoints: point.totalPoints
                };
              })
            )
          );
          return combineLatest(userDetails$);
        }),
        map(entries => entries.sort((a, b) => b.totalPoints - a.totalPoints))
      );
    }

    combineLatest([
      this.overallLeaderboard$, 
      this.weeklyLeaderboard$,
      this.selectedView === 'global' ? this.globalLeaderboard$ : of([])
    ]).subscribe({
      next: ([overall, weekly, global]) => {
        console.log('Leaderboards loaded:', { overall, weekly, global });
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