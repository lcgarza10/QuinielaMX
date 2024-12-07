import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { ToastController } from '@ionic/angular';
import { LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-points-management',
  templateUrl: './points-management.component.html',
  styleUrls: ['./points-management.component.scss']
})
export class PointsManagementComponent implements OnInit {
  userId: string = '';
  selectedRound: string = '';
  rounds: string[] = [
    'reclasificacion',
    'cuartos',
    'semifinal',
    'final'
  ];
  isProcessing: boolean = false;

  constructor(
    private databaseService: DatabaseService,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {}

  async syncPoints() {
    if (!this.userId || !this.selectedRound) {
      await this.showToast('Por favor ingrese el ID de usuario y seleccione una ronda', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Sincronizando puntos...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.isProcessing = true;
      await this.databaseService.syncPointsWithStandings(this.userId, this.selectedRound);
      await this.showToast('Puntos sincronizados exitosamente', 'success');
    } catch (error) {
      console.error('Error syncing points:', error);
      await this.showToast('Error al sincronizar puntos', 'danger');
    } finally {
      this.isProcessing = false;
      await loading.dismiss();
    }
  }

  async fixAllPoints() {
    if (!this.userId) {
      await this.showToast('Por favor ingrese el ID de usuario', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Corrigiendo todos los puntos...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.isProcessing = true;
      await this.databaseService.fixAllUserPoints(this.userId);
      await this.showToast('Todos los puntos han sido corregidos exitosamente', 'success');
    } catch (error) {
      console.error('Error fixing all points:', error);
      await this.showToast('Error al corregir los puntos', 'danger');
    } finally {
      this.isProcessing = false;
      await loading.dismiss();
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
