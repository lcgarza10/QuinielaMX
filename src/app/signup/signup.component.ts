import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { GroupService } from '../services/group.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  errorMessage: string = '';
  inviteCode: string | null = null;
  groupName: string | null = null;
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private groupService: GroupService
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      username: ['', [Validators.required]]
    });
  }

  async ngOnInit() {
    // Get invite code from route params
    this.route.queryParams.subscribe(async params => {
      const code = params['code'];
      if (code) {
        this.inviteCode = code;
        try {
          const group = await this.groupService.getGroupByInviteCode(code);
          if (group) {
            this.groupName = group.name;
          }
        } catch (error) {
          console.error('Error fetching group details:', error);
        }
      }
    });
  }

  async signupWithEmail() {
    if (this.signupForm.valid) {
      this.loading = true;
      const loading = await this.loadingController.create({
        message: 'Creando cuenta...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { email, password, firstName, lastName, username } = this.signupForm.value;
        await this.authService.signUpWithEmail(email, password, firstName, lastName, username);
        
        const toast = await this.toastController.create({
          message: '¡Cuenta creada exitosamente!',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // If there's an invite code, join the group automatically
        if (this.inviteCode) {
          try {
            await this.groupService.joinGroup(this.inviteCode);
            const joinToast = await this.toastController.create({
              message: `¡Te has unido al grupo ${this.groupName || ''} exitosamente!`,
              duration: 2000,
              color: 'success',
              position: 'top'
            });
            await joinToast.present();
          } catch (error) {
            console.error('Error joining group:', error);
            const errorToast = await this.toastController.create({
              message: 'Error al unirse al grupo. Por favor, intenta nuevamente desde la sección de grupos.',
              duration: 3000,
              color: 'warning',
              position: 'top'
            });
            await errorToast.present();
          }
        }

        this.router.navigate(['/home']);
      } catch (error: any) {
        console.error('Signup error:', error);
        this.errorMessage = this.getErrorMessage(error.code);
        const errorToast = await this.toastController.create({
          message: this.errorMessage,
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await errorToast.present();
      } finally {
        this.loading = false;
        await loading.dismiss();
      }
    }
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Este correo electrónico ya está registrado';
      case 'auth/invalid-email':
        return 'Correo electrónico inválido';
      case 'auth/operation-not-allowed':
        return 'Operación no permitida';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres';
      default:
        return 'Error al crear la cuenta. Por favor, intenta nuevamente';
    }
  }
}