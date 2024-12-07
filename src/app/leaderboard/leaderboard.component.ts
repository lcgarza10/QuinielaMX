import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { AuthService, User } from '../services/auth.service';
import { FootballService, Match, PlayoffMatch } from '../services/football.service';
import { GroupService } from '../services/group.service';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { Group } from '../models/group.model';
import { LeaderboardEntry } from '../models/leaderboard.model';
import { AngularFirestore } from '@angular/fire/compat/firestore';

// Add the WeekData interface here
interface WeekData {
  totalPoints: number;
  predictions?: any[];
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit, OnDestroy {
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
  private refreshInterval: any;

  rounds: string[] = [
    ...Array.from({ length: 17 }, (_, i) => (i + 1).toString()),
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];

  playoffPhases = [
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];

  constructor(
    private afs: AngularFirestore,
    private databaseService: DatabaseService,
    private authService: AuthService,
    private footballService: FootballService,
    private groupService: GroupService
  ) {}

  async ngOnInit() {
    // Clear any cached data
    this.clearData();
    
    this.authService.user$.subscribe(async user => {
      this.currentUserId = user?.uid || null;
      this.isAdmin = this.authService.isAdmin(user);
      
      if (user?.uid) {
        await this.loadUserGroup();
      } else {
        this.error = 'Por favor inicia sesión para ver la tabla';
      }
    });

    await this.findCurrentRound();
    await this.determineCurrentPhase();
    await this.loadMatches();

    // Check for live matches and set up auto-refresh
    this.checkLiveMatches();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private clearData() {
    this.weeklyLeaderboard$ = of([]);
    this.overallLeaderboard$ = of([]);
    this.globalLeaderboard$ = of([]);
    this.weekMatches = [];
    this.playoffMatches = [];
    this.error = null;
  }

  async refreshData() {
    this.clearData();
    await this.loadMatches();
    this.setupLeaderboards();
  }

  // Add a public refresh method that can be called from the template
  async manualRefresh() {
    this.loading = true;
    await this.refreshAuthAndData();
    this.loading = false;
  }

  private async determineCurrentPhase() {
    try {
      const allPlayoffMatches = await firstValueFrom(this.footballService.getPlayoffMatches());
      
      if (allPlayoffMatches.length > 0) {
        // Group matches by phase
        const matchesByPhase = allPlayoffMatches.reduce((acc, match) => {
          if (!acc[match.round]) {
            acc[match.round] = [];
          }
          acc[match.round].push(match);
          return acc;
        }, {} as { [key: string]: PlayoffMatch[] });

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        // Find the current phase
        for (const phase of this.playoffPhases) {
          const phaseMatches = matchesByPhase[phase] || [];
          if (phaseMatches.length === 0) continue;

          // Sort matches by date to find the last match of the phase
          const sortedMatches = phaseMatches.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          const lastMatchDate = new Date(sortedMatches[0].date);
          lastMatchDate.setHours(0, 0, 0, 0); // Set to start of day
          
          // Add one day to last match date to determine when to switch phases
          const switchDate = new Date(lastMatchDate);
          switchDate.setDate(switchDate.getDate() + 1);

          // If we haven't reached the switch date for this phase yet, this is our current phase
          if (now < switchDate) {
            this.selectedView = 'weekly';
            this.selectedRound = phase;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error determining current phase:', error);
    }
  }

  async setupLeaderboards() {
    if (!this.currentGroup) {
      console.warn('No group loaded, cannot setup leaderboards');
      return;
    }

    try {
      this.loading = true;
      
      // Force clear any cached data
      await this.groupService.clearGroupCache();
      
      // Ensure we have the latest group data
      const currentGroup = await firstValueFrom(
        this.groupService.getUserGroups().pipe(
          map(groups => groups.find(g => g.id === this.currentGroup?.id))
        )
      );

      if (!currentGroup) {
        console.error('Failed to get latest group data');
        return;
      }

      // Update current group with latest data
      this.currentGroup = currentGroup;

      console.debug('Current group members:', this.currentGroup.members);

      // Get users specifically for this group
      const groupUsers = await firstValueFrom(
        this.databaseService.getUsersByIds(this.currentGroup.members)
      );

      console.debug('Fetched group users:', groupUsers.map(u => ({ uid: u.uid, email: u.email })));

      if (groupUsers.length !== this.currentGroup.memberCount) {
        console.warn(`Participant count mismatch: UI shows ${groupUsers.length}, DB shows ${this.currentGroup.memberCount}`);
        console.warn('Missing users:', this.currentGroup.members.filter(
          memberId => !groupUsers.find(u => u.uid === memberId)
        ));
      }

      // Get total points for all users
      const pointsData = await firstValueFrom(this.databaseService.getAllUsersTotalPoints());

      // Setup the leaderboards with fresh data
      const weeklyEntries = await Promise.all(
        groupUsers.map(async user => {
          let weekId;
          if (this.playoffPhases.includes(this.selectedRound)) {
            // Map the round name to the collection name
            switch (this.selectedRound) {
              case 'Cuartos de Final':
                weekId = 'cuartos';
                break;
              case 'Semifinal':
                weekId = 'semifinal';
                break;
              case 'Final':
                weekId = 'final';
                break;
              default:
                weekId = this.selectedRound.toLowerCase();
            }
          } else {
            weekId = this.selectedRound;
          }
          const predictions = await firstValueFrom(this.databaseService.getPredictions(user.uid, weekId));
          const userPoints = pointsData.find(p => p.userId === user.uid);
          
          // Get all weeks for total points calculation
          const weeksSnapshot = await this.afs.collection(`predictions/${user.uid}/weeks`).get().toPromise();
          let totalPoints = 0;
          weeksSnapshot?.docs.forEach(doc => {
            const weekData = doc.data() as WeekData;
            if (weekData?.totalPoints) {
              totalPoints += weekData.totalPoints;
            }
          });

          return {
            userId: user.uid,
            username: user.username || user.email || 'Unknown User',
            totalPoints: totalPoints,
            weeklyPoints: this.calculateWeeklyPoints(predictions, this.weekMatches),
            livePoints: this.calculateLivePoints(predictions, this.weekMatches),
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

      // Update weekly leaderboard
      this.weeklyLeaderboard$ = of(weeklyEntries.sort((a, b) => {
        const aPoints = (a.weeklyPoints || 0) + (a.livePoints || 0);
        const bPoints = (b.weeklyPoints || 0) + (b.livePoints || 0);
        return bPoints - aPoints;
      }));

      // Use the same entries for overall and global leaderboards
      const sortedByTotal = [...weeklyEntries].sort((a, b) => b.totalPoints - a.totalPoints);
      this.overallLeaderboard$ = of(sortedByTotal);
      this.globalLeaderboard$ = of(sortedByTotal);

    } catch (error) {
      console.error('Error setting up leaderboards:', error);
      this.error = 'Error al cargar la tabla de posiciones';
    } finally {
      this.loading = false;
    }
  }

  async loadUserGroup() {
    try {
      this.loading = true;
      this.error = null;
      
      // Force clear any cached group data
      this.currentGroup = null;
      
      const groups = await firstValueFrom(this.groupService.getUserGroups());
      if (!groups || groups.length === 0) {
        this.error = 'No se encontró ningún grupo';
        return;
      }

      // Always get the first group for now
      const firstGroup = groups[0];
      if (!firstGroup.id) {
        this.error = 'Error: Grupo inválido';
        return;
      }
      
      // Force a fresh group data fetch
      await this.groupService.clearGroupCache();
      const group = await firstValueFrom(this.groupService.getUserGroups().pipe(
        map(groups => groups.find(g => g.id === firstGroup.id))
      ));
      
      if (!group) {
        this.error = 'Error al cargar el grupo';
        return;
      }

      this.currentGroup = group;
      await this.setupLeaderboards();
    } catch (error) {
      this.error = 'Error al cargar el grupo';
    } finally {
      this.loading = false;
    }
  }

  async findCurrentRound() {
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

  private calculateWeeklyPoints(predictions: any[], matches: Match[]): number {
    let points = 0;
    predictions.forEach(pred => {
      const match = matches.find(m => m.id === pred.matchId);
      if (match?.status.short === 'FT' && this.isValidPrediction(pred, match)) {
        points += this.calculateMatchPoints(pred, match);
      }
    });
    return points;
  }

  private calculateLivePoints(predictions: any[], matches: Match[]): number {
    let points = 0;
    predictions.forEach(pred => {
      const match = matches.find(m => m.id === pred.matchId);
      if ((match?.status.short === 'LIVE' || 
           match?.status.short === 'HT' || 
           match?.status.short === '1H' || 
           match?.status.short === '2H') && 
          this.isValidPrediction(pred, match)) {
        points += this.calculateMatchPoints(pred, match);
      }
    });
    return points;
  }

  private isValidPrediction(prediction: any, match: Match): boolean {
    return prediction.homeScore !== null && 
           prediction.awayScore !== null && 
           match.homeScore !== null && 
           match.awayScore !== null;
  }

  private calculateMatchPoints(prediction: any, match: Match): number {
    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    const actualResult = Math.sign(match.homeScore! - match.awayScore!);
    const isExactMatch = prediction.homeScore === match.homeScore && 
                        prediction.awayScore === match.awayScore;
    return isExactMatch ? 3 : (predictedResult === actualResult ? 1 : 0);
  }

  // Add method to clear auth state
  async clearAuthState() {
    // Sign out using Firebase Auth
    await this.authService.signOut();
    // Clear any cached data
    this.currentGroup = null;
    this.currentUserId = null;
    this.clearData();
  }

  // Add method to force refresh auth
  async refreshAuthAndData() {
    await this.clearAuthState();
    const user = await this.authService.getUser();
    if (user) {
      await this.loadUserGroup();
    }
  }

  private async checkLiveMatches() {
    try {
      const matches = await firstValueFrom(this.footballService.getMatches(this.currentRound));
      const liveMatches = matches.filter((match: Match) => ['1H', '2H', 'HT'].includes(match.status.short));

      if (liveMatches.length > 0) {
        console.log('Live matches detected:', liveMatches.map((m: Match) => `${m.homeTeam} vs ${m.awayTeam}`));
        this.startAutoRefresh();
      } else {
        console.log('No live matches. Next check in 5 minutes.');
        this.stopAutoRefresh();
        setTimeout(() => this.checkLiveMatches(), 300000); // Check again in 5 minutes
      }
    } catch (error) {
      console.error('Error checking live matches:', error);
    }
  }

  private startAutoRefresh() {
    if (!this.refreshInterval) {
      this.refreshInterval = setInterval(() => {
        this.refreshData();
      }, 30000); // Refresh every 30 seconds
    }
  }

  private stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}