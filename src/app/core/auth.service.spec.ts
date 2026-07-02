import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { AdminMe } from './models';

describe('AuthService.can', () => {
  let svc: AuthService;

  const me: AdminMe = {
    id: 1, email: 'a@b.c', name: 'A', roles: ['SUPER_ADMIN'],
    permissions: ['STAFF:VIEW', 'ROLES:EDIT'],
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideRouter([{ path: 'login', children: [] }])],
    });
    svc = TestBed.inject(AuthService);
  });

  it('returns false when not signed in', () => {
    expect(svc.can('STAFF:VIEW')).toBe(false);
  });

  it('reflects the granted permission set', () => {
    svc.me.set(me);
    expect(svc.can('STAFF:VIEW')).toBe(true);
    expect(svc.can('ROLES:EDIT')).toBe(true);
    expect(svc.can('STAFF:DELETE')).toBe(false);
  });

  it('logout clears identity and permissions', () => {
    svc.me.set(me);
    svc.logout();
    expect(svc.can('STAFF:VIEW')).toBe(false);
    expect(svc.isAuthenticated()).toBe(false);
  });
});
