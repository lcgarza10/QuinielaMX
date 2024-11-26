import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { FootballService, Match, PlayoffMatch } from '../services/football.service';
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
  hasPredicted?: boolean;
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
  selectedRound: string = '1';
  currentRound: number = 1;
  selectedView: 'weekly' | 'overall' | 'global' = 'weekly';
  weekMatches: Match[] = [];
  playoffMatches: PlayoffMatch[] = [];
  currentUserId: string | null = null;
  currentGroup: Group | null = null;
  isLiveRound: boolean = false;
  isAdmin: boolean = false;
  phaseStarted: boolean = false;
  allPredictionsSubmitted: boolean = false;
  
  rounds: string[] = [
    ...Array.from({ length: 17 }, (_, i) => (i + 1).toString()),
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];

  playoffPhases = ['Reclasificación', 'Cuartos de Final', 'Semifinal', 'Final'];

  constructor(
    private databaseService: DatabaseService,
    private authService: AuthService,
    private footballService: FootballService,
    private groupService: GroupService
  ) {}

  async ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUserId = user?.uid || null;
      this.isAdmin = this.authService.isAdmin(user);
      if (user) {
        this.loadUserGroup();
      }
    });

    await this.findCurrentRound();
    await this.determineCurrentPhase();
    await this.loadMatches();
    this.setupLeaderboards();
  }

  private async determineCurrentPhase() {
    try {
      const allPlayoffMatches = await firstValueFrom(this.footballService.getPlayoffMatches());
      
      if (allPlayoffMatches.length > 0) {
        // Sort matches by date to find the most recent/upcoming match
        const sortedMatches = [...allPlayoffMatches].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const now = new Date();
        let currentPhase = null;

        // Find the current phase based on match dates
        for (const match of sortedMatches) {
          const matchDate = new Date(match.date);
          const daysDiff = Math.abs(now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff <= 3 || matchDate > now) {
            currentPhase = match.round;
            break;
          }
        }

        if (currentPhase) {
          this.selectedView = 'weekly';
          this.selectedRound = currentPhase;
          console.log('Auto-selected playoff phase:', currentPhase);
        }
      }
    } catch (error) {
      console.error('Error determining current phase:', error);
    }
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
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      if (!this.playoffPhases.includes(this.selectedRound)) {
        this.selectedRound = currentRound.toString();
      }
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
    }
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;

    try {
      if (this.playoffPhases.includes(this.selectedRound)) {
        const allPlayoffMatches = await firstValueFrom(this.footballService.getPlayoffMatches());
        this.playoffMatches = allPlayoffMatches.filter(match => match.round === this.selectedRound);
        this.weekMatches = this.convertPlayoffToRegularMatches(this.playoffMatches);
      } else {
        this.weekMatches = await firstValueFrom(
          this.footballService.getMatches(parseInt(this.selectedRound))
        );
      }

      // Check if phase has started
      const now = new Date();
      const firstMatch = this.weekMatches[0];
      if (firstMatch) {
        const firstMatchDate = new Date(firstMatch.date);
        this.phaseStarted = now > firstMatchDate;
      }

      this.isLiveRound = this.weekMatches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );

      // Check if all group members have submitted predictions
      if (this.currentGroup) {
        const predictions = await Promise.all(
          this.currentGroup.members.map(memberId =>
            firstValueFrom(this.databaseService.getPredictions(memberId, this.selectedRound))
          )
        );
        this.allPredictionsSubmitted = predictions.every(p => p && p.length > 0);
      }

      this.setupLeaderboards();
    } catch (error) {
      console.error('Error loading matches:', error);
      this.error = 'Error al cargar los partidos';
    } finally {
      this.loading = false;
    }
  }

  private convertPlayoffToRegularMatches(playoffMatches: PlayoffMatch[]): Match[] {
    return playoffMatches.map(match => ({
      ...match,
      weekNumber: 0
    }));
  }

  onRoundChange(round: string) {
    this.selectedRound = round;
    this.loadMatches();
  }

  onViewChange() {
    this.setupLeaderboards();
  }

  shouldShowPrediction(userId: string): boolean {
    return (
      this.isAdmin ||
      userId === this.currentUserId ||
      this.phaseStarted ||
      this.allPredictionsSubmitted
    );
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

  private setupLeaderboards() {
    // Weekly Leaderboard with detailed predictions
    this.weeklyLeaderboard$ = this.databaseService.getAllUsers().pipe(
      map(users => users.filter(user => 
        this.currentGroup ? this.currentGroup.members.includes(user.uid) : true
      )),
      switchMap(users => {
        const userPredictions$ = users.map(user => {
          const weekId = this.playoffPhases.includes(this.selectedRound) ? 'playoffs' : this.selectedRound;
          return this.databaseService.getPredictions(user.uid, weekId).pipe(
            map(predictions => {
              let weeklyPoints = 0;
              let livePoints = 0;

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
                })),
                hasPredicted: predictions.length > 0
              };
            })
          );
        });
        return combineLatest(userPredictions$);
      }),
      map(entries => entries.sort((a, b) => {
        const aPoints = (a.weeklyPoints || 0) + (a.livePoints || 0);
        const bPoints = (b.weeklyPoints || 0) + (b.livePoints || 0);
        return bPoints - aPoints;
      }))
    );

    // Overall leaderboard
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

    // Global leaderboard
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
}