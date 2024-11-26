import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VersionService {
  private readonly version: string;

  constructor() {
    this.version = environment.production ? '0.1.03' : '0.1.03-dev';
  }

  getVersion(): string {
    return `v${this.version}`;
  }
}
