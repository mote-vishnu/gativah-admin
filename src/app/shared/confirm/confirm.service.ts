import { Injectable, signal } from '@angular/core';

export interface ConfirmInput {
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  input?: ConfirmInput; // when set, the dialog also captures text (replaces window.prompt)
}

export interface ConfirmResult {
  confirmed: boolean;
  value?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (r: ConfirmResult) => void;
}

/**
 * Themed confirm/prompt dialog. Mount <ui-confirm-host> once (in the shell).
 * Replaces native confirm()/prompt(): returns a Promise and can capture a
 * rationale string for destructive moderation/billing actions.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  confirm(opts: ConfirmOptions): Promise<ConfirmResult> {
    return new Promise<ConfirmResult>((resolve) => {
      this.state.set({ ...opts, resolve });
    });
  }

  accept(value?: string): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve({ confirmed: true, value });
  }

  cancel(): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve({ confirmed: false });
  }
}
