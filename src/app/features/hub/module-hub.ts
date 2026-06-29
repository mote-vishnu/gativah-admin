import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { HubComponent, HubConfig } from '../../shared/hub/hub';

/**
 * Generic hub page — renders the {@link HubConfig} supplied via the route's
 * `data.hub`. Used for the top-level module landing and each module's own hub.
 */
@Component({
  selector: 'app-module-hub',
  standalone: true,
  imports: [HubComponent],
  template: `<ui-hub [config]="config" />`,
})
export class ModuleHubComponent {
  private readonly route = inject(ActivatedRoute);
  readonly config = this.route.snapshot.data['hub'] as HubConfig;
}
