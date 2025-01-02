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
    // Por defecto, configuramos para Apertura 2022
    const defaultStartDate = new Date(2022, 6, 1); // 1 de julio 2022
    const defaultEndDate = new Date(2022, 11, 31); // 31 de diciembre 2022

    this.seasonForm = this.fb.group({
      name: ['Apertura 2022', [Validators.required]],
      startDate: [this.formatDateForInput(defaultStartDate), [Validators.required]],
      endDate: [this.formatDateForInput(defaultEndDate), [Validators.required]],
      isActive: [true]
    });

    // Actualizar fechas cuando cambia la temporada
    this.seasonForm.get('name')?.valueChanges.subscribe(name => {
      if (!name) return;
      
      let startDate: Date;
      let endDate: Date;

      if (name === 'Apertura 2022') {
        startDate = new Date(2022, 6, 1);  // 1 de julio 2022
        endDate = new Date(2022, 11, 31);  // 31 de diciembre 2022
      } else if (name === 'Apertura 2024') {
        startDate = new Date(2024, 6, 1);  // 1 de julio 2024
        endDate = new Date(2024, 11, 31);  // 31 de diciembre 2024
      } else if (name === 'Clausura 2024') {
        startDate = new Date(2025, 0, 1);  // 1 de enero 2025
        endDate = new Date(2025, 4, 31);   // 31 de mayo 2025
      }

      this.seasonForm.patchValue({
        startDate: this.formatDateForInput(startDate!),
        endDate: this.formatDateForInput(endDate!)
      }, { emitEvent: false });
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
        const startDate = this.formatDateForInput(new Date(season.startDate));
        const endDate = this.formatDateForInput(new Date(season.endDate));
        
        this.seasonForm.patchValue({
          name: season.name,
          startDate,
          endDate,
          isActive: season.isActive
        });

        console.log('Loaded season:', {
          name: season.name,
          startDate,
          endDate,
          isActive: season.isActive
        });
      }
    } catch (error: any) {
      console.error('Error loading season:', error);
      this.error = 'Error al cargar la configuración de la temporada: ' + (error.message || 'Error desconocido');
    }
  }

  private formatDateForInput(date: Date): string {
    try {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      let month = '' + (d.getMonth() + 1);
      let day = '' + d.getDate();
      const year = d.getFullYear();

      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;

      return [year, month, day].join('-');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  async saveSeason() {
    if (this.seasonForm.valid) {
      this.loading = true;
      this.error = null;
      
      try {
        const formValues = this.seasonForm.value;
        console.log('Form values before save:', formValues);

        const seasonData = {
          name: formValues.name,
          startDate: new Date(formValues.startDate + 'T00:00:00'),
          endDate: new Date(formValues.endDate + 'T23:59:59'),
          isActive: formValues.isActive
        };

        console.log('Season data to save:', seasonData);
        await this.seasonService.saveSeason(seasonData);

        const toast = await this.toastController.create({
          message: 'Configuración de temporada guardada exitosamente',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        
        this.router.navigate(['/admin/test-predictions']);
      } catch (error: any) {
        console.error('Error saving season:', error);
        const errorMessage = error?.message || 'Error desconocido';
        this.error = 'Error al guardar la configuración de la temporada: ' + errorMessage;
        
        const toast = await this.toastController.create({
          message: 'Error al guardar la configuración: ' + errorMessage,
          duration: 3000,
          color: 'danger'
        });
        await toast.present();
      } finally {
        this.loading = false;
      }
    }
  }
}