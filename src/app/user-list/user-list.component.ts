import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { User } from '../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
  users$: Observable<User[]>;
  loading: boolean = true;
  error: string | null = null;

  constructor(private databaseService: DatabaseService) {
    this.users$ = new Observable<User[]>();
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.error = null;
    this.users$ = this.databaseService.getAllUsers();
    this.users$.subscribe({
      next: (users) => {
        this.loading = false;
        console.log('Users loaded:', users);
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Failed to load users. Please try again.';
        console.error('Error loading users:', err);
      }
    });
  }
}