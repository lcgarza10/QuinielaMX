import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private readonly version: string;

  constructor() {
    this.version = environment.production ? '0.9.31' : '0.9.31-dev';
  }

  getVersion(): string {
    return `Beta v${this.version}`;
  }
}