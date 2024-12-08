import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VersionService {
  private readonly version: string;

  constructor() {
    this.version = environment.production ? '1.30' : '1.30-dev';
  }

  getVersion(): string {
    return `v${this.version}`;
  }
}