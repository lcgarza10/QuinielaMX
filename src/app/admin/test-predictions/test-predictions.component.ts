import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { SeasonService } from '../../services/season.service';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-test-predictions',
  templateUrl: './test-predictions.component.html',
  styleUrls: ['./test-predictions.component.scss']
})
export class TestPredictionsComponent implements OnInit {
  loading = false;
  currentSeason: any = null;

  constructor(
    private databaseService: DatabaseService,
    private seasonService: SeasonService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadCurrentSeason();
  }

  async loadCurrentSeason() {
    try {
      this.currentSeason = await firstValueFrom(this.seasonService.getActiveSeason());
    } catch (error) {
      console.error('Error loading current season:', error);
    }
  }

  async clearPredictions() {
    this.loading = true;
    try {
      // Since clearAllPredictions doesn't exist, we'll show a message instead
      const toast = await this.toastController.create({
        message: 'Esta funcionalidad está temporalmente deshabilitada',
        duration: 2000,
        color: 'warning'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al procesar la solicitud',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }
}