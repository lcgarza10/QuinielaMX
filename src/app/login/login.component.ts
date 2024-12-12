import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController, AlertController } from '@ionic/angular';
import { VersionService } from '../services/version.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  version: string;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private toastController: ToastController,
    private alertController: AlertController,
    private versionService: VersionService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.version = this.versionService.getVersion();
  }

  ngOnInit() {}

  async loginWithEmail() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      try {
        await this.authService.signInWithEmail(email, password);
        const toast = await this.toastController.create({
          message: '¡Bienvenido de vuelta!',
          duration: 2000,
          position: 'top',
          color: 'success'
        });
        await toast.present();
        this.router.navigate(['/home']);
      } catch (error: any) {
        this.errorMessage = this.getErrorMessage(error.code);
      }
    }
  }

  async loginWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
      const toast = await this.toastController.create({
        message: '¡Bienvenido!',
        duration: 2000,
        position: 'top',
        color: 'success'
      });
      await toast.present();
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message === 'NEEDS_PROFILE_SETUP') {
        // Redirect to signup page for new Google users
        this.router.navigate(['/signup'], { queryParams: { provider: 'google' } });
        return;
      }
      
      // If it's a Firebase error, use the code
      if (error.code) {
        this.errorMessage = this.getErrorMessage(error.code);
      } else {
        // If it's our custom error, use the message
        this.errorMessage = error.message;
      }
    }
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Restablecer Contraseña',
      message: 'Ingresa tu correo electrónico para recibir un enlace de restablecimiento de contraseña',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Correo electrónico'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (!data.email) {
              this.showToast('Por favor ingresa un correo electrónico', 'warning');
              return false;
            }
            try {
              await this.authService.resetPassword(data.email);
              this.showToast('Se ha enviado un enlace de restablecimiento a tu correo', 'success');
              return true;
            } catch (error: any) {
              this.showToast(this.getErrorMessage(error.code), 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No existe una cuenta con este correo electrónico';
      case 'auth/wrong-password':
        return 'Contraseña incorrecta';
      case 'auth/invalid-email':
        return 'Correo electrónico inválido';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Por favor, intenta más tarde';
      case 'auth/popup-closed-by-user':
        return 'Inicio de sesión cancelado. Por favor intenta de nuevo.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes e intenta de nuevo.';
      case 'auth/cancelled-popup-request':
        return 'Operación cancelada. Por favor intenta de nuevo.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Por favor verifica tu conexión a internet.';
      default:
        return 'Error al iniciar sesión. Por favor, intenta de nuevo';
    }
  }
}