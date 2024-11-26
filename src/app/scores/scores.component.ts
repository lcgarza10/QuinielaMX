import { Component, OnInit } from '@angular/core';
import { FootballService, Match, PlayoffMatch } from '../services/football.service';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

interface ScoreMatch extends Match {
  prediction?: {
    homeScore: number | null;
    awayScore: number | null;
    points?: number;
    livePoints?: number;
  };
}

@Component({
  selector: 'app-scores',
  templateUrl: './scores.component.html',
  styleUrls: ['./scores.component.scss']
})
export class ScoresComponent implements OnInit {
  matches: ScoreMatch[] = [];
  playoffMatches: PlayoffMatch[] = [];
  loading: boolean = true;
  error: string | null = null;
  selectedRound: string = '1';
  currentRound: number = 1;
  rounds: string[] = [
    ...Array.from({ length: 17 }, (_, i) => (i + 1).toString()),
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];
  isRateLimited: boolean = false;
  isLiveRound: boolean = false;
  isRoundFinished: boolean = false;
  userId: string | null = null;
  totalPoints: number = 0;
  selectedView: 'regular' | 'playoffs' = 'playoffs'; // Changed default to playoffs
  playoffRounds = [
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];

  constructor(
    private footballService: FootballService,
    private databaseService: DatabaseService,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.userId = user?.uid || null;
    });
    
    // Determine current phase on initialization
    await this.determineCurrentPhase();
  }

  private async determineCurrentPhase() {
    try {
      const allPlayoffMatches = await firstValueFrom(this.footballService.getPlayoffMatches());
      
      if (allPlayoffMatches.length > 0) {
        const sortedMatches = [...allPlayoffMatches].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const now = new Date();
        let currentPhase = null;

        // Find the current or upcoming phase
        for (const match of sortedMatches) {
          const matchDate = new Date(match.date);
          const daysDiff = Math.abs(now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff <= 3 || matchDate > now) {
            currentPhase = match.round;
            break;
          }
        }

        if (currentPhase) {
          // Set view to playoffs and load playoff matches
          this.selectedView = 'playoffs';
          await this.loadPlayoffMatches();
        } else {
          // If no current playoff phase, switch to regular season
          this.selectedView = 'regular';
          await this.findCurrentRound();
        }
      } else {
        // If no playoff matches, default to regular season
        this.selectedView = 'regular';
        await this.findCurrentRound();
      }
    } catch (error) {
      console.error('Error determining current phase:', error);
      this.selectedView = 'regular';
      await this.findCurrentRound();
    }
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedRound = currentRound.toString();
      await this.loadMatches();
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
    }
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;
    this.isRateLimited = false;
    this.totalPoints = 0;

    try {
      const [matches, predictions] = await Promise.all([
        firstValueFrom(this.footballService.getMatches(parseInt(this.selectedRound))),
        this.userId ? firstValueFrom(this.databaseService.getPredictions(this.userId, this.selectedRound)) : []
      ]);
      
      this.matches = this.sortMatchesByStatus(matches).map(match => {
        const prediction = predictions.find(p => p.matchId === match.id);
        let points = 0;
        let livePoints = 0;

        if (prediction && prediction.homeScore !== null && prediction.awayScore !== null &&
            match.homeScore !== null && match.awayScore !== null) {
          
          const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
          const actualResult = Math.sign(match.homeScore - match.awayScore);
          const isExactMatch = prediction.homeScore === match.homeScore && 
                             prediction.awayScore === match.awayScore;
          const isPartialMatch = predictedResult === actualResult;

          if (match.status.short === 'FT') {
            if (isExactMatch) {
              points = 3;
            } else if (isPartialMatch) {
              points = 1;
            }
            this.totalPoints += points;
          } 
          else if (match.status.short === 'LIVE' || 
                  match.status.short === 'HT' || 
                  match.status.short === '1H' || 
                  match.status.short === '2H') {
            if (isExactMatch) {
              livePoints = 3;
            } else if (isPartialMatch) {
              livePoints = 1;
            }
            this.totalPoints += livePoints;
          }
        }

        return {
          ...match,
          prediction: {
            homeScore: prediction?.homeScore ?? null,
            awayScore: prediction?.awayScore ?? null,
            points,
            livePoints
          }
        };
      });
      
      this.isLiveRound = matches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT' ||
        match.status.short === '1H' ||
        match.status.short === '2H'
      );

      const completedMatches = matches.filter(match => 
        match.status.short === 'FT' || 
        match.status.short === 'AET' || 
        match.status.short === 'PEN'
      );
      this.isRoundFinished = completedMatches.length === matches.length;
      
      if (this.matches.length === 0) {
        await this.showToast('No hay partidos programados para esta jornada', 'warning');
      }
    } catch (error: any) {
      console.error('Error loading matches:', error);
      
      if (error.error?.code === 2100) {
        this.isRateLimited = true;
        this.error = 'Se ha alcanzado el límite de la API. Los datos mostrados pueden no estar actualizados.';
        await this.showToast('Límite de API alcanzado. Se muestran datos en caché.', 'warning');
      } else {
        this.error = 'Error al cargar los partidos. Por favor intente nuevamente.';
        await this.showToast('Error al cargar los partidos', 'danger');
      }
    } finally {
      this.loading = false;
    }
  }

  onRoundChange(round: string) {
    this.selectedRound = round;
    this.loadMatches();
  }

  onViewChange() {
    if (this.selectedView === 'regular') {
      this.findCurrentRound();
    } else {
      this.loadPlayoffMatches();
    }
  }

  async loadPlayoffMatches() {
    try {
      const matches = await firstValueFrom(this.footballService.getPlayoffMatches());
      if (this.userId) {
        const predictions = await firstValueFrom(
          this.databaseService.getPredictions(this.userId, 'playoffs')
        );
        
        this.playoffMatches = matches.map(match => {
          const prediction = predictions.find(p => p.matchId === match.id);
          let points = 0;

          if (prediction && prediction.homeScore !== null && prediction.awayScore !== null &&
              match.homeScore !== null && match.awayScore !== null) {
            
            const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
            const actualResult = Math.sign(match.homeScore - match.awayScore);
            const isExactMatch = prediction.homeScore === match.homeScore && 
                               prediction.awayScore === match.awayScore;
            const isPartialMatch = predictedResult === actualResult;

            if (match.status.short === 'FT') {
              if (isExactMatch) {
                points = 3;
              } else if (isPartialMatch) {
                points = 1;
              }
            }
          }

          return {
            ...match,
            prediction: {
              homeScore: prediction?.homeScore ?? null,
              awayScore: prediction?.awayScore ?? null,
              points
            }
          };
        });
      } else {
        this.playoffMatches = matches;
      }
    } catch (error) {
      console.error('Error loading playoff matches:', error);
    }
  }

  private sortMatchesByStatus(matches: Match[]): Match[] {
    const statusPriority: { [key: string]: number } = {
      'LIVE': 0,
      'HT': 1,
      '1H': 2,
      '2H': 3,
      'NS': 4,
      'FT': 5,
      'AET': 6,
      'PEN': 7
    };

    return [...matches].sort((a, b) => {
      const statusA = statusPriority[a.status.short] ?? 999;
      const statusB = statusPriority[b.status.short] ?? 999;

      if (statusA === statusB) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return statusA - statusB;
    });
  }

  getRoundStatus(): string {
    if (this.isLiveRound) {
      return 'Jornada en curso';
    }
    if (this.isRoundFinished) {
      return 'Jornada finalizada';
    }
    return `Jornada ${this.selectedRound}`;
  }

  getMatchStatus(match: Match): string {
    if (match.status.short === 'LIVE') {
      if (match.status.elapsed) {
        if (match.status.elapsed <= 45) {
          return `Primer Tiempo ${match.status.elapsed}'`;
        } else {
          return `Segundo Tiempo ${match.status.elapsed}'`;
        }
      }
      return 'En Vivo';
    }
    
    if (match.status.short === 'HT') {
      return 'Medio Tiempo';
    }
    
    if (match.status.short === 'FT') {
      return 'Finalizado';
    }

    if (match.status.short === '1H') {
      return `Primer Tiempo ${match.status.elapsed}'`;
    }

    if (match.status.short === '2H') {
      return `Segundo Tiempo ${match.status.elapsed}'`;
    }
    
    if (match.status.short === 'NS') {
      const matchDate = new Date(match.date);
      const now = new Date();
      const diffMinutes = Math.floor((matchDate.getTime() - now.getTime()) / (1000 * 60));
      
      if (diffMinutes <= 60 && diffMinutes > 0) {
        return `Comienza en ${diffMinutes} min`;
      } else if (diffMinutes <= 0) {
        return 'Por comenzar';
      } else if (diffMinutes <= 120) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        return `Comienza en ${hours}h ${mins}m`;
      } else {
        return this.formatMatchTime(matchDate);
      }
    }
    
    const statusTranslations: { [key: string]: string } = {
      'PST': 'Pospuesto',
      'CANC': 'Cancelado',
      'ABD': 'Abandonado',
      'INT': 'Interrumpido',
      'SUSP': 'Suspendido',
      'TBD': 'Por definir',
      'AWD': 'Victoria administrativa',
      'WO': 'Walkover',
      'PEN': 'Penales',
      'AET': 'Tiempo extra',
      'BREAK': 'Descanso',
      'ET': 'Tiempo extra',
      'P': 'Penales'
    };

    return statusTranslations[match.status.short] || match.status.long || 'Programado';
  }

  getPredictionClass(match: ScoreMatch): string {
    if (!match.prediction?.homeScore || !match.prediction?.awayScore || 
        match.homeScore === null || match.awayScore === null) {
      return 'no-match';
    }

    const predictedResult = Math.sign(match.prediction.homeScore - match.prediction.awayScore);
    const actualResult = Math.sign(match.homeScore - match.awayScore);
    const isExactMatch = match.prediction.homeScore === match.homeScore && 
                        match.prediction.awayScore === match.awayScore;
    const isPartialMatch = predictedResult === actualResult && !isExactMatch;
    const isLive = match.status.short === 'LIVE' || 
                  match.status.short === 'HT' || 
                  match.status.short === '1H' || 
                  match.status.short === '2H';

    if (match.status.short === 'FT') {
      if (isExactMatch) return 'exact-match';
      if (isPartialMatch) return 'partial-match';
      return 'no-match';
    } else if (isLive) {
      if (isExactMatch) return 'exact-match live';
      if (isPartialMatch) return 'partial-match live';
      return 'no-match live';
    }
    
    return 'no-match';
  }

  private formatMatchTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}