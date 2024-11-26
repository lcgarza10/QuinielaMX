import { Component, OnInit } from '@angular/core';
import { FootballService, Match, PlayoffMatch } from '../services/football.service';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
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
  loading: boolean = true;
  error: string | null = null;
  selectedRound: number = 1;
  currentRound: number = 1;
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  userId: string | null = null;
  isOffline: boolean = false;
  hasPredictions: boolean = false;
  weeklyPoints: number = 0;
  isRateLimited: boolean = false;
  savingPredictions: boolean = false;
  isLiveRound: boolean = false;
  selectedView: 'regular' | 'playoffs' = 'playoffs'; // Changed default to 'playoffs'
  playoffRounds: string[] = [
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];
  selectedPlayoffRound: string = 'Reclasificación';

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
    this.authService.user$.subscribe(user => {
      this.userId = user?.uid || null;
      if (this.userId) {
        // Load playoff matches by default
        this.loadPlayoffMatches();
      } else {
        this.error = 'Usuario no autenticado';
        this.loading = false;
      }
    });

    this.connectionService.getOnlineStatus().subscribe(status => {
      this.isOffline = !status;
    });
  }

  onRoundChange(round: number) {
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

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedRound = currentRound;
      await this.loadMatches();
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
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
    
    // If match is finished, no predictions allowed
    if (match.status.short === 'FT') {
      return false;
    }

    // If match is live or at halftime, no predictions allowed
    if (match.status.short === 'LIVE' || match.status.short === 'HT') {
      return false;
    }

    // Allow predictions if match hasn't started yet
    if (match.status.short === 'NS') {
      return true;
    }

    // For any other status, check if we're within 5 minutes of match start
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    const timeUntilMatch = matchDate.getTime() - now.getTime();
    return timeUntilMatch > fiveMinutes;
  }

  isSubmitDisabled(): boolean {
    const matches = this.selectedView === 'playoffs' ? this.playoffMatches : this.matches;
    
    // Check if there are any predictable matches
    const predictableMatches = matches.filter(m => m.canPredict);
    if (predictableMatches.length === 0) {
      return true;
    }

    // Check if at least one predictable match has a prediction
    return !predictableMatches.some(m => 
      m.prediction?.homeScore !== null && 
      m.prediction?.awayScore !== null
    );
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;
    this.weeklyPoints = 0;
    this.isRateLimited = false;
    
    if (this.userId) {
      try {
        const [matches, predictions] = await Promise.all([
          firstValueFrom(this.footballService.getMatches(this.selectedRound)),
          firstValueFrom(this.databaseService.getPredictions(this.userId, this.selectedRound.toString()))
        ]);
        
        const validPredictions = predictions.filter(p => 
          p.matchId && (p.homeScore !== null && p.awayScore !== null)
        );
        this.hasPredictions = validPredictions.length > 0;
        
        // Check if any match is live
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

        if (this.hasPredictions) {
          this.weeklyPoints = predictions.reduce((total, pred) => total + (pred.points || 0), 0);
        }

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
          await this.showOfflineAlert();
        }
        this.loading = false;
      }
    } else {
      this.error = 'Usuario no autenticado';
      this.loading = false;
    }
  }

  async loadPlayoffMatches() {
    this.loading = true;
    this.error = null;
    this.weeklyPoints = 0;
    this.isRateLimited = false;

    if (this.userId) {
      try {
        const [matches, predictions] = await Promise.all([
          firstValueFrom(this.footballService.getPlayoffMatches()),
          firstValueFrom(this.databaseService.getPredictions(this.userId, 'playoffs'))
        ]);

        console.log('Loaded playoff matches:', matches);
        console.log('Selected round:', this.selectedPlayoffRound);

        // Filter matches by selected playoff round
        const filteredMatches = matches.filter(match => match.round === this.selectedPlayoffRound);
        console.log('Filtered matches:', filteredMatches);

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

        // Check if user has any predictions for this round
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
  }

  async submitPredictions() {
    if (!this.userId) {
      await this.showAlert('Error', 'Usuario no autenticado');
      return;
    }

    if (this.isOffline) {
      await this.showAlert('Sin conexión', 'No hay conexión a internet. Por favor intente nuevamente cuando tenga conexión.');
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
      const weekId = this.selectedView === 'playoffs' ? 'playoffs' : this.selectedRound.toString();

      // Filter only matches that can be predicted and have predictions
      const predictions = matches
        .filter(m => m.canPredict && 
                    m.prediction?.homeScore !== null && 
                    m.prediction?.awayScore !== null)
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

      // Show interstitial ad after successful submission
      await this.adsService.showInterstitial();
      
      if (this.selectedView === 'playoffs') {
        await this.loadPlayoffMatches();
      } else {
        await this.loadMatches();
      }
    } catch (error) {
      console.error('Error saving predictions:', error);
      await this.showToast(
        typeof error === 'string' ? error : 'Error al guardar las predicciones. Por favor intente nuevamente.',
        'danger'
      );
    } finally {
      this.savingPredictions = false;
      if (loading) {
        await loading.dismiss();
      }
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showOfflineAlert() {
    const alert = await this.alertController.create({
      header: 'Modo Sin Conexión',
      message: 'Actualmente está sin conexión. Algunas funciones pueden estar limitadas.',
      buttons: ['OK']
    });
    await alert.present();
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
}