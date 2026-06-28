import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Blocks the shell until a staff token exists. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.parseUrl('/login');
};

/** Gates a feature route on a `FEATURE:ACTION` permission; redirects to /forbidden otherwise. */
export const permissionGuard = (code: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.can(code) ? true : router.parseUrl('/forbidden');
};
