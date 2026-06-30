import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the staff bearer token and keeps the session alive:
 *  - On a 401 from a protected call (expired token), silently refresh once and
 *    retry the original request; if the refresh fails (revoked/disabled), sign out.
 *  - On a 403 (lacking permission), route to the Access-denied page.
 * The login/MFA/refresh endpoints are exempt so they surface their own errors
 * (and a failed refresh can't recurse into another refresh).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  const onAuthRoute = req.url.includes('/admin/auth/');

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // Expired token on a normal call → one silent refresh + retry.
      if (err.status === 401 && !onAuthRoute && token) {
        return auth.refresh().pipe(
          switchMap(() =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.token()}` } })),
          ),
          catchError(() => {
            // Refresh itself failed → the session is gone; sign out cleanly.
            auth.logout();
            return throwError(() => err);
          }),
        );
      }
      if (err.status === 403 && !onAuthRoute) {
        void router.navigate(['/forbidden']);
      }
      return throwError(() => err);
    }),
  );
};
