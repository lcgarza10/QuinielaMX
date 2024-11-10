import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-team-form',
  templateUrl: './team-form.component.html',
  styleUrls: ['./team-form.component.scss']
})
export class TeamFormComponent {
  @Input() form: string = '';

  getFormArray(): string[] {
    return this.form ? this.form.split('').reverse() : [];
  }

  getResultClass(result: string): string {
    switch (result.toUpperCase()) {
      case 'W': return 'win';
      case 'D': return 'draw';
      case 'L': return 'loss';
      default: return '';
    }
  }

  getResultIcon(result: string): string {
    switch (result.toUpperCase()) {
      case 'W': return 'checkmark';
      case 'D': return 'remove';
      case 'L': return 'close';
      default: return '';
    }
  }
}