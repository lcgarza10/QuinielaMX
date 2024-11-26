import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';
import { InvitationService } from '../../services/invitation.service';
import { RegistrationData, RegistrationValidation } from '../../models/registration.model';

@Component({
  selector: 'app-registration-form',
  templateUrl: './registration-form.component.html',
  styleUrls: ['./registration-form.component.scss']
})
export class RegistrationFormComponent implements OnInit, OnDestroy {
  registrationForm: FormGroup;
  loading = false;
  errorMessage = '';
  inviteCode: string | null = null;
  groupName: string | null = null;
  private subscriptions: Subscription[] = [];

  validation: RegistrationValidation = {
    email: true,
    password: true,
    confirmPassword: true,
    username: true,
    passwordsMatch: true
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private groupService: GroupService,
    private invitationService: InvitationService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    this.registrationForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      inviteCode: [{ value: '', disabled: true }]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Extract invite code from URL
    const inviteCodeSub = this.route.params.subscribe(async params => {
      const code = params['code'];
      if (code) {
        const isValid = await this.invitationService.validateInviteCode(code);
        if (isValid) {
          this.inviteCode = code;
          this.registrationForm.patchValue({ inviteCode: code });
        } else {
          this.showToast('Código de invitación inválido', 'danger');
          this.router.navigate(['/signup']);
        }
      }
    });

    // Subscribe to invitation info updates
    const invitationSub = this.invitationService.getInvitationInfo().subscribe(info => {
      if (info) {
        this.groupName = info.groupName;
      }
    });

    this.subscriptions.push(inviteCodeSub, invitationSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.invitationService.clearInvitationInfo();
  }

  async onSubmit() {
    if (this.registrationForm.valid && this.validateForm()) {
      this.loading = true;
      const loading = await this.loadingController.create({
        message: 'Creando cuenta...'
      });
      await loading.present();

      try {
        const formData = this.registrationForm.value as RegistrationData;
        
        // Create user account
        await this.authService.signUpWithEmail(
          formData.email,
          formData.password,
          formData.username,
          '',
          formData.username
        );

        // Join group if invite code exists
        if (this.inviteCode) {
          await this.groupService.joinGroup(this.inviteCode);
          await this.showToast(
            `¡Bienvenido! Te has unido al grupo ${this.groupName || ''}`,
            'success'
          );
        } else {
          await this.showToast('¡Cuenta creada exitosamente!', 'success');
        }

        this.router.navigate(['/home']);
      } catch (error: any) {
        console.error('Registration error:', error);
        this.errorMessage = this.getErrorMessage(error.code);
        await this.showToast(this.errorMessage, 'danger');
      } finally {
        this.loading = false;
        await loading.dismiss();
      }
    }
  }

  private validateForm(): boolean {
    const formData = this.registrationForm.value as RegistrationData;
    
    this.validation = {
      email: !!formData.email && this.registrationForm.get('email')?.valid || false,
      password: !!formData.password && formData.password.length >= 6,
      confirmPassword: !!formData.confirmPassword,
      username: !!formData.username && formData.username.length >= 3,
      passwordsMatch: formData.password === formData.confirmPassword
    };

    return Object.values(this.validation).every(valid => valid);
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
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