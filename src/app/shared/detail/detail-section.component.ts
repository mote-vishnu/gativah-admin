import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

import { IconComponent } from '../icon';

/**
 * A panel with per-section inline edit: a read `[view]` slot and an `[edit]`
 * slot, an Edit affordance, and a Cancel/Save footer. The `editing` state is
 * two-way bindable so the parent resets it after a successful save.
 *   <ui-detail-section title="Identity" [canEdit]="canEdit()" [(editing)]="edit"
 *                      [saving]="saving()" (editStart)="seedDraft()" (save)="save()">
 *     <div view>…definition grid…</div>
 *     <div edit>…form…</div>
 *   </ui-detail-section>
 */
@Component({
  selector: 'ui-detail-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="sec">
      <div class="sec-h">
        <h3>{{ title() }}</h3>
        @if (canEdit() && !editing()) {
          <button type="button" class="edit" (click)="startEdit()"><lucide-icon name="pencil" [size]="13" /> {{ editLabel() }}</button>
        }
      </div>
      @if (!editing()) {
        <ng-content select="[view]" />
      } @else {
        <ng-content select="[edit]" />
        <div class="sec-foot">
          <button type="button" class="btn" (click)="onCancel()" [disabled]="saving()">Cancel</button>
          <button type="button" class="btn primary" (click)="save.emit()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .sec { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 20px 22px; }
    .sec-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .sec-h h3 { font-family: var(--sans); font-weight: 700; font-size: 15px; margin: 0; letter-spacing: -0.01em; }
    .edit { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 9px; cursor: pointer; transition: 0.15s var(--ease); }
    .edit:hover { color: var(--brand); border-color: var(--brand-line); }
    .sec-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
  `,
})
export class DetailSectionComponent {
  readonly title = input('');
  readonly canEdit = input(true);
  readonly editLabel = input('Edit');
  readonly saving = input(false);
  readonly editing = model(false);

  /** Fires when the user enters edit mode — seed the form draft here. */
  readonly editStart = output<void>();
  readonly save = output<void>();
  readonly cancel = output<void>();

  startEdit(): void {
    this.editing.set(true);
    this.editStart.emit();
  }

  onCancel(): void {
    this.editing.set(false);
    this.cancel.emit();
  }
}
