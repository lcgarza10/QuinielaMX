import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match } from '../services/football.service';
import { GroupService } from '../services/group.service';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

interface LeaderboardEntry {
  userId: string;
  username: string;
  totalPoints: number;
  weeklyPoints?: number;
  predictions?: Array<{
    matchId: number;
    homeScore: number;
    awayScore: number;
    points: number;
  }>;
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  weeklyLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  overallLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  globalLeaderboard$: Observable<LeaderboardEntry[]> = of([]);
  loading: boolean = true;
  error: string | null = null;
  selectedRound: number = 1;
  currentRound: number = 1;
  selectedView: 'weekly' | 'overall' | 'global' = 'weekly';
  weekMatches: Match[] = [];
  currentUserId: string | null = null;

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private footballService: FootballService,
    private groupService: GroupService
  ) {}

  async ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUserId = user?.uid || null;
    });

    await this.findCurrentRound();
    await this.loadWeekMatches();
    this.setupLeaderboards();
  }

  private async findCurrentRound() {
    try {
      this.currentRound = await this.footballService.getCurrentRound();
      this.selectedRound = this.currentRound;
    } catch (error) {
      console.error('Error finding current round:', error);
      this.currentRound = 1;
      this.selectedRound = 1;
    }
  }

  private async loadWeekMatches() {
    try {
      this.weekMatches = await firstValueFrom(
        this.footballService.getMatches(this.selectedRound)
      );
    } catch (error) {
      console.error('Error loading week matches:', error);
      this.weekMatches = [];
    }
  }

  private setupLeaderboards() {
    // Weekly Leaderboard with detailed predictions
    this.weeklyLeaderboard$ = this.databaseService.getAllUsers().pipe(
      switchMap(users => {
        const userPredictions$ = users.map(user =>
          this.databaseService.getPredictions(user.uid, this.selectedRound.toString()).pipe(
            map(predictions => {
              const weeklyPoints = predictions.reduce((sum, pred) => sum + (pred.points || 0), 0);
              return {
                userId: user.uid,
                username: user.username || user.email || 'Unknown User',
                totalPoints: 0, // Will be updated with overall points
                weeklyPoints,
                predictions: predictions.map(pred => ({
                  matchId: pred.matchId,
                  homeScore: pred.homeScore!,
                  awayScore: pred.awayScore!,
                  points: pred.points || 0
                }))
              };
            })
          )
        );
        return combineLatest(userPredictions$);
      }),
      map(entries => entries.sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0)))
    );

    // Overall and Global leaderboards
    this.overallLeaderboard$ = this.databaseService.getAllUsersTotalPoints().pipe(
      switchMap(points => {
        const userDetails$ = points.map(point =>
          this.databaseService.getAllUsers().pipe(
            map(users => {
              const user = users.find(u => u.uid === point.userId);
              return {
                userId: point.userId,
                username: user?.username || user?.email || 'Unknown User',
                totalPoints: point.totalPoints,
                weeklyPoints: 0
              };
            })
          )
        );
        return combineLatest(userDetails$);
      }),
      map(entries => entries.sort((a, b) => b.totalPoints - a.totalPoints))
    );

    this.globalLeaderboard$ = this.overallLeaderboard$;
  }

  async onRoundChange(round: number) {
    this.selectedRound = round;
    await this.loadWeekMatches();
    this.setupLeaderboards();
  }

  onViewChange() {
    this.setupLeaderboards();
  }
}