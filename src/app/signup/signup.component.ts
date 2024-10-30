import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  errorMessage: string = '';
  maxDate: string;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      username: ['', [Validators.required]],
      dob: ['', [Validators.required]]
    });
    this.maxDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit() {
    // Any additional initialization logic can go here
  }

  async signupWithEmail() {
    if (this.signupForm.valid) {
      const { email, password, firstName, lastName, username, dob } = this.signupForm.value;
      try {
        await this.authService.signUpWithEmail(email, password, firstName, lastName, username, dob);
        this.router.navigate(['/home']);
      } catch (error: any) {
        this.errorMessage = 'Signup failed: ' + error.message;
      }
    }
  }
}