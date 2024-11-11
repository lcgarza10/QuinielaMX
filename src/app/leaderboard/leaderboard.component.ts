import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match } from '../services/football.service';
import { GroupService, Group } from '../services/group.service';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

interface LeaderboardEntry {
  userId: string;
  username: string;
  totalPoints: number;
  weeklyPoints?: number;
  livePoints?: number;
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
  currentGroup: Group | null = null;
  isLiveRound: boolean = false;

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private footballService: FootballService,
    private groupService: GroupService
  ) {}

  async ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUserId = user?.uid || null;
      if (user) {
        this.loadUserGroup();
      }
    });

    await this.findCurrentRound();
    await this.loadWeekMatches();
    this.setupLeaderboards();
  }

  getPrediction(predictions: any[] | undefined, match: Match) {
    if (!predictions) return null;
    return predictions.find(p => p.matchId === match.id);
  }

  getPredictionPoints(predictions: any[] | undefined, match: Match): number {
    const prediction = this.getPrediction(predictions, match);
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    const actualResult = Math.sign(match.homeScore - match.awayScore);
    const isExactMatch = prediction.homeScore === match.homeScore && 
                        prediction.awayScore === match.awayScore;
    const isPartialMatch = predictedResult === actualResult;

    if (match.status.short === 'FT' || 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT' || 
        match.status.short === '1H' || 
        match.status.short === '2H') {
      if (isExactMatch) {
        return 3;
      } else if (isPartialMatch) {
        return 1;
      }
    }

    return 0;
  }

  private async loadUserGroup() {
    try {
      const groups = await firstValueFrom(this.groupService.getUserGroups());
      if (groups.length > 0) {
        this.currentGroup = groups[0];
        this.setupLeaderboards();
      }
    } catch (error) {
      console.error('Error loading user group:', error);
    }
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

      // Check if any match is live
      this.isLiveRound = this.weekMatches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT' ||
        match.status.short === '1H' ||
        match.status.short === '2H'
      );
    } catch (error) {
      console.error('Error loading week matches:', error);
      this.weekMatches = [];
    }
  }

  private setupLeaderboards() {
    // Weekly Leaderboard with detailed predictions
    this.weeklyLeaderboard$ = this.databaseService.getAllUsers().pipe(
      map(users => users.filter(user => 
        this.currentGroup ? this.currentGroup.members.includes(user.uid) : true
      )),
      switchMap(users => {
        const userPredictions$ = users.map(user =>
          this.databaseService.getPredictions(user.uid, this.selectedRound.toString()).pipe(
            map(predictions => {
              let weeklyPoints = 0;
              let livePoints = 0;

              // Calculate points for each prediction
              predictions.forEach(pred => {
                const match = this.weekMatches.find(m => m.id === pred.matchId);
                if (match && pred.homeScore !== null && pred.awayScore !== null &&
                    match.homeScore !== null && match.awayScore !== null) {
                  
                  const predictedResult = Math.sign(pred.homeScore - pred.awayScore);
                  const actualResult = Math.sign(match.homeScore - match.awayScore);
                  const isExactMatch = pred.homeScore === match.homeScore && 
                                     pred.awayScore === match.awayScore;
                  const isPartialMatch = predictedResult === actualResult;

                  if (match.status.short === 'FT') {
                    if (isExactMatch) {
                      weeklyPoints += 3;
                    } else if (isPartialMatch) {
                      weeklyPoints += 1;
                    }
                  } 
                  else if (match.status.short === 'LIVE' || 
                          match.status.short === 'HT' || 
                          match.status.short === '1H' || 
                          match.status.short === '2H') {
                    if (isExactMatch) {
                      livePoints += 3;
                    } else if (isPartialMatch) {
                      livePoints += 1;
                    }
                  }
                }
              });

              return {
                userId: user.uid,
                username: user.username || user.email || 'Unknown User',
                totalPoints: 0,
                weeklyPoints,
                livePoints,
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
      map(entries => entries.sort((a, b) => {
        const aPoints = (a.weeklyPoints || 0) + (a.livePoints || 0);
        const bPoints = (b.weeklyPoints || 0) + (b.livePoints || 0);
        return bPoints - aPoints;
      }))
    );

    // Overall leaderboard (group filtered)
    this.overallLeaderboard$ = this.databaseService.getAllUsersTotalPoints().pipe(
      switchMap(points => {
        const userDetails$ = points
          .filter(point => this.currentGroup ? this.currentGroup.members.includes(point.userId) : true)
          .map(point =>
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

    // Global leaderboard (no filter)
    this.globalLeaderboard$ = this.databaseService.getAllUsersTotalPoints().pipe(
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