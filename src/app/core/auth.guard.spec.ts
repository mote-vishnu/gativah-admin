import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { authGuard, permissionGuard } from './auth.guard';
import { AdminMe } from './models';

function runGuard(guard: () => unknown): unknown {
  // CanActivateFn runs in an injection context; args are ignored by these guards.
  return TestBed.runInInjectionContext(() => (guard as () => unknown)());
}

describe('auth guards', () => {
  let auth: AuthService;
  const me = (perms: string[]): AdminMe => ({ id: 1, email: 'a', name: 'A', roles: [], permissions: perms });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([{ path: 'login', children: [] }, { path: 'forbidden', children: [] }]),
      ],
    });
    auth = TestBed.inject(AuthService);
  });

  it('permissionGuard allows a holder of the permission', () => {
    auth.me.set(me(['STAFF:VIEW']));
    (localStorage as Storage).setItem('gativah-admin.token', 'x');
    expect(runGuard(() => permissionGuard('STAFF:VIEW')(null as never, null as never))).toBe(true);
  });

  it('permissionGuard redirects to /forbidden without the permission', () => {
    auth.me.set(me(['ROLES:VIEW']));
    const result = runGuard(() => permissionGuard('STAFF:VIEW')(null as never, null as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('/forbidden');
  });

  it('authGuard redirects to /login when unauthenticated', () => {
    const result = runGuard(() => authGuard(null as never, null as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('/login');
  });
});
