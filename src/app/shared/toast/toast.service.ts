import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

/**
 * App-wide toast/snackbar feedback. Mount <ui-toast-host> once (in the shell).
 * Use for the success/failure of every mutation instead of per-screen banners.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(message: string, tone: ToastTone = 'info', action?: Toast['action'], ttlMs = 4500): number {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, message, tone, action }]);
    if (ttlMs > 0) {
      setTimeout(() => this.dismiss(id), ttlMs);
    }
    return id;
  }

  success(message: string, action?: Toast['action']): number {
    return this.show(message, 'success', action);
  }

  error(message: string): number {
    return this.show(message, 'error', undefined, 7000);
  }

  info(message: string, action?: Toast['action']): number {
    return this.show(message, 'info', action);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
