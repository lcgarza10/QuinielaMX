import { Component, OnInit } from '@angular/core';
import { FootballService, Match, PlayoffMatch } from '../services/football.service';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { firstValueFrom, BehaviorSubject } from 'rxjs';
import { ConnectionService } from '../services/connection.service';
import { PredictionData } from './match-prediction/match-prediction.component';
import { AdsService } from '../services/ads.service';

interface MatchWithPrediction extends Match {
  prediction: PredictionData;
  canPredict: boolean;
}

interface PlayoffMatchWithPrediction extends PlayoffMatch {
  prediction: PredictionData;
  canPredict: boolean;
}

@Component({
  selector: 'app-pools',
  templateUrl: './pools.component.html',
  styleUrls: ['./pools.component.scss']
})
export class PoolsComponent implements OnInit {
  matches: MatchWithPrediction[] = [];
  playoffMatches: PlayoffMatchWithPrediction[] = [];
  loading = true;
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
  userId: string | null = null;
  isOffline: boolean = false;
  hasPredictions: boolean = false;
  weeklyPoints: number = 0;
  isRateLimited: boolean = false;
  savingPredictions: boolean = false;
  isLiveRound: boolean = false;
  selectedView: 'regular' | 'playoffs' = 'playoffs';
  playoffRounds: string[] = [
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];
  selectedPlayoffRound: string = 'Reclasificación';
  private dataLoaded = new BehaviorSubject<boolean>(false);

  constructor(
    private footballService: FootballService,
    private databaseService: DatabaseService,
    private authService: AuthService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private connectionService: ConnectionService,
    private adsService: AdsService
  ) {}

  async ngOnInit() {
    try {
      const user = await firstValueFrom(this.authService.user$);
      this.userId = user?.uid || null;
      
      // Determinar la fase actual
      this.selectedPlayoffRound = await this.footballService.getCurrentPhase();
      
      if (this.selectedView === 'playoffs') {
        await this.loadPlayoffMatches();
      } else {
        await this.loadMatches();
      }
      
      this.setupConnectionListener();
    } catch (error) {
      console.error('Error in initialization:', error);
      this.error = 'Error loading matches';
    } finally {
      this.loading = false;
      this.dataLoaded.next(true);
    }
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
          this.selectedView = 'playoffs';
          this.selectedPlayoffRound = currentPhase;
          await this.loadPlayoffMatches();
        } else {
          this.selectedView = 'regular';
          await this.findCurrentRound();
        }
      } else {
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
    if (!this.userId) {
      this.error = 'Usuario no autenticado';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;
    this.isRateLimited = false;

    try {
      const [matches, predictions] = await Promise.all([
        firstValueFrom(this.footballService.getMatches(parseInt(this.selectedRound))),
        firstValueFrom(this.databaseService.getPredictions(this.userId, this.selectedRound))
      ]);

      const validPredictions = predictions.filter(p => 
        p.matchId && (p.homeScore !== null && p.awayScore !== null)
      );
      this.hasPredictions = validPredictions.length > 0;

      this.isLiveRound = matches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );

      this.matches = matches.map(match => {
        const prediction = predictions.find(p => p.matchId === match.id);
        const canPredict = this.canPredictMatch(match);
        
        return {
          ...match,
          prediction: {
            homeScore: prediction?.homeScore ?? null,
            awayScore: prediction?.awayScore ?? null
          },
          canPredict
        };
      });

      this.loading = false;
      this.isOffline = false;

      if (this.matches.length === 0) {
        this.error = 'No hay partidos programados para esta jornada.';
      }
    } catch (error: any) {
      console.error('Error loading matches:', error);
      if (error.error?.code === 2100) {
        this.isRateLimited = true;
        this.error = 'Se ha alcanzado el límite de la API. Los datos mostrados pueden no estar actualizados.';
        await this.showToast('Límite de API alcanzado. Se muestran datos en caché.', 'warning');
      } else {
        this.error = 'Error al cargar los partidos. Por favor intente nuevamente.';
        this.isOffline = true;
      }
      this.loading = false;
    }
  }

  async loadPlayoffMatches() {
    if (!this.userId) {
      this.error = 'Usuario no autenticado';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // Mapear el nombre de la ronda al ID de la colección
      let weekId;
      switch (this.selectedPlayoffRound) {
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
          weekId = this.selectedPlayoffRound.toLowerCase();
      }

      const [matches, predictions] = await Promise.all([
        firstValueFrom(this.footballService.getPlayoffMatches()),
        firstValueFrom(this.databaseService.getPredictions(this.userId, weekId))
      ]);

      const filteredMatches = matches.filter(match => match.round === this.selectedPlayoffRound);

      this.playoffMatches = filteredMatches.map(match => {
        const prediction = predictions.find(p => p.matchId === match.id);
        const canPredict = this.canPredictMatch(match);

        return {
          ...match,
          prediction: {
            homeScore: prediction?.homeScore ?? null,
            awayScore: prediction?.awayScore ?? null
          },
          canPredict
        };
      });

      this.hasPredictions = predictions.some(p => 
        this.playoffMatches.some(m => m.id === p.matchId)
      );

      this.loading = false;
      this.isOffline = false;

      if (this.playoffMatches.length === 0) {
        this.error = 'No hay partidos de playoff programados para esta fase.';
      }
    } catch (error) {
      console.error('Error loading playoff matches:', error);
      this.loading = false;
      this.error = 'Error al cargar los partidos de playoff';
      await this.showToast('Error al cargar los partidos de playoff', 'danger');
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

  getWeekTitle(): string {
    if (this.hasPredictions) {
      return `Estatus de tu Quiniela para esta Jornada: `;
    }
    return `Estatus de tu Quiniela para esta Jornada: `;
  }

  onPredictionChange(match: MatchWithPrediction | PlayoffMatchWithPrediction, prediction: PredictionData) {
    match.prediction = prediction;
  }

  private canPredictMatch(match: Match | PlayoffMatch): boolean {
    const now = new Date();
    const matchDate = new Date(match.date);
    
    // For liguilla matches that haven't started yet, allow editing even if predictions exist
    if (this.selectedView === 'playoffs' && match.status.short === 'NS') {
      return true;
    }

    if (match.status.short === 'FT') {
      return false;
    }

    if (match.status.short === 'LIVE' || match.status.short === 'HT') {
      return false;
    }

    if (match.status.short === 'NS') {
      return true;
    }

    const fiveMinutes = 5 * 60 * 1000;
    const timeUntilMatch = matchDate.getTime() - now.getTime();
    return timeUntilMatch > fiveMinutes;
  }

  isSubmitDisabled(): boolean {
    const matches = this.selectedView === 'playoffs' ? this.playoffMatches : this.matches;
    
    const predictableMatches = matches.filter(m => m.canPredict);
    if (predictableMatches.length === 0) {
      return true;
    }

    return !predictableMatches.some(m => 
      m.prediction?.homeScore !== null && 
      m.prediction?.awayScore !== null
    );
  }

  shouldShowSubmitButton(): boolean {
    if (this.selectedView === 'playoffs') {
      return this.playoffMatches.some(m => m.canPredict);
    }
    return !this.hasPredictions && (this.matches.length > 0 || this.playoffMatches.length > 0);
  }

  getSubmitButtonText(): string {
    return this.selectedView === 'playoffs' && this.hasPredictions 
      ? 'Actualizar Pronósticos' 
      : 'Guardar Predicciones';
  }

  async submitPredictions() {
    if (!this.userId) {
      await this.showToast('Usuario no autenticado', 'danger');
      return;
    }

    if (this.isOffline) {
      await this.showToast('No hay conexión a internet', 'warning');
      return;
    }

    let loading: HTMLIonLoadingElement | null = null;
    this.savingPredictions = true;

    try {
      loading = await this.loadingController.create({
        message: 'Guardando predicciones...',
        spinner: 'crescent'
      });
      await loading.present();

      const matches = this.selectedView === 'playoffs' ? this.playoffMatches : this.matches;
      let weekId;
      
      if (this.selectedView === 'playoffs') {
        // Mapear el nombre de la ronda al ID de la colección
        switch (this.selectedPlayoffRound) {
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
            weekId = this.selectedPlayoffRound.toLowerCase();
        }
      } else {
        weekId = this.selectedRound;
      }

      const predictions = matches
        .filter(m => {
          const isPlayoffMatch = this.selectedView === 'playoffs';
          const canEditPlayoff = isPlayoffMatch && m.status?.short === 'NS';
          return (m.canPredict || canEditPlayoff) && 
                 m.prediction?.homeScore !== null && 
                 m.prediction?.awayScore !== null;
        })
        .map(m => ({
          matchId: m.id,
          homeScore: m.prediction.homeScore!,
          awayScore: m.prediction.awayScore!
        }));

      if (predictions.length === 0) {
        throw new Error('No hay predicciones válidas para guardar');
      }

      await this.databaseService.savePredictions(
        this.userId,
        weekId,
        predictions,
        0
      );

      await this.showToast(
        `Se guardaron ${predictions.length} predicciones exitosamente`, 
        'success'
      );

      await this.adsService.showInterstitial();
      
      if (this.selectedView === 'playoffs') {
        await this.loadPlayoffMatches();
      } else {
        await this.loadMatches();
      }
    } catch (error) {
      console.error('Error saving predictions:', error);
      await this.showToast(
        typeof error === 'string' ? error : 'Error al guardar las predicciones',
        'danger'
      );
    } finally {
      this.savingPredictions = false;
      if (loading) {
        await loading.dismiss();
      }
    }
  }

  private async showToast(message: string, color: string) {
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

  private setupConnectionListener() {
    this.connectionService.getOnlineStatus().subscribe(status => {
      this.isOffline = !status;
    });
  }
}