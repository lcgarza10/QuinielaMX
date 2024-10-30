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
      await this.databaseService.clearAllPredictions();
      const toast = await this.toastController.create({
        message: 'Todas las predicciones han sido eliminadas',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al eliminar predicciones',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }

  async insertTestData() {
    this.loading = true;
    try {
      await this.databaseService.insertTestPredictions();
      const toast = await this.toastController.create({
        message: 'Datos de prueba insertados exitosamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al insertar datos de prueba',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }

  async resetPasswords() {
    this.loading = true;
    try {
      await this.databaseService.resetAllUserPasswords('Password123!');
      const toast = await this.toastController.create({
        message: 'Contraseñas restablecidas exitosamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al restablecer contraseñas',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }

  async fixWeekNumbers() {
    this.loading = true;
    try {
      await this.databaseService.fixWeekNumbers();
      const toast = await this.toastController.create({
        message: 'Números de semana corregidos exitosamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al corregir números de semana',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }
}