import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { API_BASE_URL } from './environment';

/**
 * Caches the id→name map of admin operators so logs/assignees can show
 * "Ananya R." instead of "#5". Loaded once, lazily, on first use.
 */
@Injectable({ providedIn: 'root' })
export class AdminDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly names = signal<Map<number, string>>(new Map());
  private loading = false;

  load(): void {
    if (this.loading || this.names().size > 0) { return; }
    this.loading = true;
    this.http.get<{ items: { id: number; name: string }[] }>(`${API_BASE_URL}/admin/staff/directory`).subscribe({
      next: (r) => {
        const m = new Map<number, string>();
        r.items.forEach((i) => m.set(i.id, i.name));
        this.names.set(m);
      },
      error: () => { this.loading = false; },
    });
  }

  /** Resolve an admin id to a display name, falling back to "#id". */
  name(id: number | null | undefined): string {
    if (id == null) { return '—'; }
    return this.names().get(id) ?? '#' + id;
  }

  /** All known admins as {id, name}, for building actor filters. */
  entries(): { id: number; name: string }[] {
    return [...this.names().entries()].map(([id, name]) => ({ id, name }));
  }
}
