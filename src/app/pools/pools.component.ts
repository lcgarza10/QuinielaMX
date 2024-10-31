import { Component, OnInit } from '@angular/core';
import { FootballService, Match } from '../services/football.service';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ConnectionService } from '../services/connection.service';
import { PredictionData } from './match-prediction/match-prediction.component';

interface MatchWithPrediction extends Match {
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

  constructor(
    private footballService: FootballService,
    private databaseService: DatabaseService,
    private authService: AuthService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private connectionService: ConnectionService
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.userId = user ? user.uid : null;
      if (this.userId) {
        this.findCurrentRound();
      } else {
        this.error = 'Usuario no autenticado';
        this.loading = false;
      }
    });

    this.connectionService.getOnlineStatus().subscribe(status => {
      this.isOffline = !status;
    });
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      if (currentRound) {
        this.currentRound = currentRound;
        this.selectedRound = currentRound;
        await this.loadMatches();
      } else {
        throw new Error('No se pudo determinar la jornada actual');
      }
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
    }
  }

  getWeekTitle(): string {
    if (this.hasPredictions) {
      return `Resultados de la Jornada ${this.selectedRound}`;
    }
    return `Juegos de la Jornada ${this.selectedRound}`;
  }

  onPredictionChange(match: MatchWithPrediction, prediction: PredictionData) {
    match.prediction = prediction;
  }

  onRoundChange(round: number) {
    this.selectedRound = round;
    this.loadMatches();
  }

  private canPredictMatch(match: Match): boolean {
    const now = new Date();
    const matchDate = new Date(match.date);
    
    if (match.status.short === 'LIVE' || 
        match.status.short === 'HT' || 
        match.status.short === 'FT') {
      return false;
    }

    const fiveMinutes = 5 * 60 * 1000;
    if (matchDate.getTime() - now.getTime() <= fiveMinutes) {
      return false;
    }

    return true;
  }

  isSubmitDisabled(): boolean {
    return this.loading || !this.matches.some(m => m.canPredict === true) || this.hasPredictions;
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
        
        this.hasPredictions = predictions.length > 0;
        
        this.matches = matches.map(match => {
          const prediction = predictions.find(p => p.matchId === match.id);
          return {
            ...match,
            prediction: {
              homeScore: prediction?.homeScore ?? null,
              awayScore: prediction?.awayScore ?? null
            },
            canPredict: this.canPredictMatch(match)
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

  async submitPredictions() {
    if (!this.userId) {
      await this.showAlert('Error', 'Usuario no autenticado');
      return;
    }

    if (this.isOffline) {
      await this.showAlert('Sin conexión', 'No hay conexión a internet. Por favor intente nuevamente cuando tenga conexión.');
      return;
    }

    const invalidPredictions = this.matches.filter(m => 
      !m.canPredict && 
      m.prediction?.homeScore !== null && 
      m.prediction?.awayScore !== null
    );

    if (invalidPredictions.length > 0) {
      await this.showAlert(
        'Predicciones no permitidas',
        'No se pueden hacer predicciones para partidos que ya comenzaron o están por comenzar.'
      );
      return;
    }

    let loading: HTMLIonLoadingElement | null = null;

    try {
      loading = await this.loadingController.create({
        message: 'Guardando predicciones...',
        spinner: 'crescent'
      });
      await loading.present();

      const predictions = this.matches
        .filter(m => m.canPredict && m.prediction?.homeScore !== null && m.prediction?.awayScore !== null)
        .map(m => ({
          matchId: m.id,
          homeScore: m.prediction.homeScore!,
          awayScore: m.prediction.awayScore!
        }));

      await firstValueFrom(this.databaseService.savePredictions(
        this.userId,
        this.selectedRound.toString(),
        predictions,
        0
      ));

      await this.showToast('Predicciones guardadas exitosamente', 'success');
      this.hasPredictions = true;
      await this.loadMatches();
    } catch (error) {
      console.error('Error saving predictions:', error);
      await this.showToast('Error al guardar las predicciones', 'danger');
    } finally {
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