import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { SeasonService } from '../../services/season.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-season-management',
  templateUrl: './season-management.component.html',
  styleUrls: ['./season-management.component.scss']
})
export class SeasonManagementComponent implements OnInit {
  seasonForm: FormGroup;
  loading = false;
  error: string | null = null;
  currentSeason: any = null;

  constructor(
    private fb: FormBuilder,
    private seasonService: SeasonService,
    private toastController: ToastController,
    private router: Router
  ) {
    // Initialize with Clausura 2024 as default
    this.seasonForm = this.fb.group({
      name: ['Apertura 2024', [Validators.required]],
      startDate: ['2024-07-01', [Validators.required]], // Apertura 2024 start
      endDate: ['2024-12-16', [Validators.required]], // Apertura 2024 end
      isActive: [true]
    });
  }

  ngOnInit() {
    this.loadCurrentSeason();
  }

  async loadCurrentSeason() {
    try {
      const season = await firstValueFrom(this.seasonService.getActiveSeason());
      if (season) {
        this.currentSeason = season;
        // Format dates to YYYY-MM-DD for input[type="date"]
        const startDate = this.formatDateForInput(season.startDate);
        const endDate = this.formatDateForInput(season.endDate);
        
        this.seasonForm.patchValue({
          name: season.name,
          startDate: startDate,
          endDate: endDate,
          isActive: season.isActive
        });

        console.log('Loaded season:', {
          name: season.name,
          startDate,
          endDate,
          isActive: season.isActive
        });
      }
    } catch (error) {
      console.error('Error loading season:', error);
      this.error = 'Error al cargar la configuración de la temporada';
    }
  }

  private formatDateForInput(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  async saveSeason() {
    if (this.seasonForm.valid) {
      this.loading = true;
      this.error = null;
      
      try {
        const { name, startDate, endDate, isActive } = this.seasonForm.value;
        await this.seasonService.saveSeason({
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive
        });

        const toast = await this.toastController.create({
          message: 'Configuración de temporada guardada exitosamente',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        
        this.router.navigate(['/admin/test-predictions']);
      } catch (error) {
        console.error('Error saving season:', error);
        this.error = 'Error al guardar la configuración de la temporada';
        
        const toast = await this.toastController.create({
          message: 'Error al guardar la configuración',
          duration: 2000,
          color: 'danger'
        });
        await toast.present();
      } finally {
        this.loading = false;
      }
    }
  }
}