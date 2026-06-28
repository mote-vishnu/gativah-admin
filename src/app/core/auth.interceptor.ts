import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the staff bearer token. On a 401/403 from a protected call, route to
 * the Access-denied page instead of forcibly logging the operator out — they can
 * navigate back or choose to sign in again. The login/MFA endpoints are exempt
 * (the login screen surfaces their errors itself).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      const onAuthRoute = req.url.includes('/admin/auth/');
      if ((err.status === 401 || err.status === 403) && !onAuthRoute) {
        void router.navigate(['/forbidden']);
      }
      return throwError(() => err);
    }),
  );
};
