import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { GroupService } from '../services/group.service';
import { firstValueFrom } from 'rxjs';

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
  error: string | null = null;
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

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.inviteCode = code;
      this.loadGroupInfo(code);
    }

    // Check if coming from Google Sign-In
    const source = this.route.snapshot.queryParamMap.get('source');
    if (source === 'google') {
      const googleData = sessionStorage.getItem('googleSignUpData');
      if (googleData) {
        const userData = JSON.parse(googleData);
        // Pre-fill the form with Google data
        this.signupForm.patchValue({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        });
        // Disable email field since it comes from Google
        this.signupForm.get('email')?.disable();
        // Remove password requirement for Google sign-up
        this.signupForm.get('password')?.clearValidators();
        this.signupForm.get('password')?.updateValueAndValidity();
      }
    }
  }

  private async loadGroupInfo(code: string) {
    try {
      const group = await firstValueFrom(this.groupService.getGroupByInviteCode(code));
      if (group) {
        this.groupName = group.name;
      } else {
        this.error = 'Código de invitación inválido';
      }
    } catch (error) {
      this.error = 'Error al cargar la información del grupo';
    }
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
        
        // Check if this is a Google Sign-In completion
        const source = this.route.snapshot.queryParamMap.get('source');
        if (source === 'google') {
          await this.authService.completeGoogleSignUp(username);
        } else {
          await this.authService.signUpWithEmail(email, password, firstName, lastName, username);
        }
        
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