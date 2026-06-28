import { Routes } from '@angular/router';

import { authGuard, permissionGuard } from './core/auth.guard';

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
        path: 'users',
        canActivate: [permissionGuard('USERS:VIEW')],
        loadComponent: () => import('./features/users/users-list').then((m) => m.UsersListComponent),
      },
      {
        path: 'users/:id',
        canActivate: [permissionGuard('USERS:VIEW')],
        loadComponent: () => import('./features/users/user-detail').then((m) => m.UserDetailComponent),
      },
      {
        path: 'content',
        canActivate: [permissionGuard('CONTENT:VIEW')],
        loadComponent: () => import('./features/content/content-list').then((m) => m.ContentListComponent),
      },
      {
        path: 'clubs',
        canActivate: [permissionGuard('CLUBS:VIEW')],
        loadComponent: () => import('./features/clubs/clubs-list').then((m) => m.ClubsListComponent),
      },
      {
        path: 'clubs/:id',
        canActivate: [permissionGuard('CLUBS:VIEW')],
        loadComponent: () => import('./features/clubs/club-detail').then((m) => m.ClubDetailComponent),
      },
      {
        path: 'moderation',
        canActivate: [permissionGuard('GRIEVANCES:VIEW')],
        loadComponent: () => import('./features/moderation/moderation-list').then((m) => m.ModerationListComponent),
      },
      {
        path: 'moderation/:id',
        canActivate: [permissionGuard('GRIEVANCES:VIEW')],
        loadComponent: () => import('./features/moderation/report-detail').then((m) => m.ReportDetailComponent),
      },
      {
        path: 'finance',
        canActivate: [permissionGuard('FINANCE:VIEW')],
        loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
      },
      {
        path: 'staff',
        canActivate: [permissionGuard('STAFF:VIEW')],
        loadComponent: () => import('./features/staff/staff').then((m) => m.StaffComponent),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard('ROLES:VIEW')],
        loadComponent: () => import('./features/roles/roles').then((m) => m.RolesComponent),
      },
      {
        path: 'legal',
        canActivate: [permissionGuard('LEGAL:VIEW')],
        loadComponent: () => import('./features/legal/legal-list').then((m) => m.LegalListComponent),
      },
      {
        path: 'legal/:id',
        canActivate: [permissionGuard('LEGAL:VIEW')],
        loadComponent: () => import('./features/legal/legal-detail').then((m) => m.LegalDetailComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/audit/audit').then((m) => m.AuditComponent),
      },
      {
        path: 'security',
        loadComponent: () => import('./features/security/security').then((m) => m.SecurityComponent),
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./features/forbidden/forbidden').then((m) => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
