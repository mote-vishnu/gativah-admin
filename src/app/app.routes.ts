import { Routes } from '@angular/router';

import { authGuard, permissionGuard } from './core/auth.guard';
import { HOME_HUB } from './layout/hub-configs';

const moduleHub = () => import('./features/hub/module-hub').then((m) => m.ModuleHubComponent);

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
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: moduleHub, data: { hub: HOME_HUB } },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },

      // Users (single function)
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

      // Insights module
      {
        path: 'insights',
        canActivate: [permissionGuard('ANALYTICS:VIEW')],
        loadComponent: () => import('./features/analytics/analytics').then((m) => m.AnalyticsComponent),
      },

      // Content module
      {
        path: 'content',
        children: [
          { path: '', redirectTo: 'posts', pathMatch: 'full' },
          {
            path: 'posts',
            canActivate: [permissionGuard('CONTENT:VIEW')],
            data: { view: 'content' },
            loadComponent: () => import('./features/content/content-list').then((m) => m.ContentListComponent),
          },
          {
            path: 'stories',
            canActivate: [permissionGuard('CONTENT:VIEW')],
            data: { view: 'stories' },
            loadComponent: () => import('./features/content/content-list').then((m) => m.ContentListComponent),
          },
        ],
      },

      // Grievances module
      {
        path: 'moderation',
        children: [
          { path: '', redirectTo: 'queue', pathMatch: 'full' },
          {
            path: 'queue',
            canActivate: [permissionGuard('GRIEVANCES:VIEW')],
            loadComponent: () => import('./features/moderation/moderation-list').then((m) => m.ModerationListComponent),
          },
          {
            path: 'appeals',
            canActivate: [permissionGuard('APPEALS:VIEW')],
            loadComponent: () => import('./features/moderation/appeals-list').then((m) => m.AppealsListComponent),
          },
          {
            path: 'history',
            canActivate: [permissionGuard('GRIEVANCES:VIEW')],
            loadComponent: () => import('./features/moderation/moderation-history').then((m) => m.ModerationHistoryComponent),
          },
          {
            path: 'region-bans',
            canActivate: [permissionGuard('GRIEVANCES:VIEW')],
            loadComponent: () => import('./features/moderation/region-bans').then((m) => m.RegionBansComponent),
          },
          {
            path: ':id',
            canActivate: [permissionGuard('GRIEVANCES:VIEW')],
            loadComponent: () => import('./features/moderation/report-detail').then((m) => m.ReportDetailComponent),
          },
        ],
      },

      // Finance module
      {
        path: 'finance',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            canActivate: [permissionGuard('FINANCE:VIEW')],
            data: { view: 'dashboard' },
            loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
          },
          {
            path: 'transactions',
            canActivate: [permissionGuard('FINANCE:VIEW')],
            data: { view: 'history', tab: 'transactions' },
            loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
          },
          {
            path: 'subscriptions',
            canActivate: [permissionGuard('FINANCE:VIEW')],
            data: { view: 'history', tab: 'subscriptions' },
            loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
          },
          {
            path: 'webhooks',
            canActivate: [permissionGuard('FINANCE:VIEW')],
            data: { view: 'history', tab: 'webhooks' },
            loadComponent: () => import('./features/finance/finance').then((m) => m.FinanceComponent),
          },
        ],
      },

      // Billing module
      {
        path: 'billing',
        children: [
          { path: '', redirectTo: 'entitlements', pathMatch: 'full' },
          {
            path: 'entitlements',
            canActivate: [permissionGuard('BILLING:VIEW')],
            data: { tab: 'entitlements' },
            loadComponent: () => import('./features/billing/billing-list').then((m) => m.BillingListComponent),
          },
          {
            path: 'refunds',
            canActivate: [permissionGuard('BILLING:VIEW')],
            data: { tab: 'refunds' },
            loadComponent: () => import('./features/billing/billing-list').then((m) => m.BillingListComponent),
          },
        ],
      },

      // Staff & Roles module
      {
        path: 'team',
        children: [
          { path: '', redirectTo: 'staff', pathMatch: 'full' },
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
            path: 'roles/:id',
            canActivate: [permissionGuard('ROLES:VIEW')],
            loadComponent: () => import('./features/roles/role-detail').then((m) => m.RoleDetailComponent),
          },
        ],
      },

      // Clubs (single function)
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
        path: 'clubs/:id/events/:eventId',
        canActivate: [permissionGuard('CLUBS:VIEW')],
        loadComponent: () => import('./features/clubs/club-event-detail').then((m) => m.ClubEventDetailComponent),
      },

      // Legal (single function)
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

      { path: 'audit', loadComponent: () => import('./features/audit/audit').then((m) => m.AuditComponent) },
      { path: 'security', loadComponent: () => import('./features/security/security').then((m) => m.SecurityComponent) },
      { path: 'forbidden', loadComponent: () => import('./features/forbidden/forbidden').then((m) => m.ForbiddenComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
