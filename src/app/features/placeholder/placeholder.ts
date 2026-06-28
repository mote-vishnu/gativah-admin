import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  template: `
    <h1 class="title">{{ title }}</h1>
    <div class="card">
      <p class="muted">{{ note }}</p>
    </div>
  `,
  styles: `
    .title { font-family: var(--disp); font-size: 22px; margin: 0 0 18px; letter-spacing: -0.02em; }
  `,
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  title = (this.route.snapshot.data['title'] as string) ?? 'Coming soon';
  note = (this.route.snapshot.data['note'] as string) ?? '';
}
