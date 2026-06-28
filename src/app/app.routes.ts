import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'moderation',
        loadComponent: () => import('./features/moderation/moderation-list').then((m) => m.ModerationListComponent),
      },
      {
        path: 'moderation/:id',
        loadComponent: () => import('./features/moderation/report-detail').then((m) => m.ReportDetailComponent),
      },
      {
        path: 'finance',
        loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
      },
      {
        path: 'staff',
        loadComponent: () => import('./features/placeholder/placeholder').then((m) => m.PlaceholderComponent),
        data: { title: 'Staff & Roles', note: 'Staff management endpoints land in Phase 2.' },
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/placeholder/placeholder').then((m) => m.PlaceholderComponent),
        data: { title: 'Audit Log', note: 'The audit-log read endpoint is a Phase 2 addition.' },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
