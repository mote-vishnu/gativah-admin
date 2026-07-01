import { HubConfig } from '../shared/hub/hub';

/** Top-level landing — every module as a card, grouped by area. */
export const HOME_HUB: HubConfig = {
  title: 'Gativah Admin Console',
  subtitle: 'Choose a module to manage',
  icon: 'layout-dashboard',
  tint: 'tint-orange',
  sections: [
    {
      title: 'Operations',
      tiles: [
        { label: 'Overview', desc: 'Live KPIs, dashboards & product analytics', icon: 'layout-dashboard', link: '/dashboard', tint: 'tint-orange' },
        { label: 'Moderation', desc: 'Grievances, appeals & content review', icon: 'flag', link: '/moderation/queue', tint: 'tint-rose', perm: 'GRIEVANCES:VIEW' },
        { label: 'Finance', desc: 'Revenue, transactions & billing', icon: 'dollar-sign', link: '/finance/dashboard', tint: 'tint-green', perm: 'FINANCE:VIEW' },
        { label: 'Community', desc: 'Members & clubs', icon: 'users-round', link: '/users', tint: 'tint-cyan', perm: 'USERS:VIEW' },
      ],
    },
    {
      title: 'Governance',
      tiles: [
        { label: 'Legal & Disclosure', desc: 'Lawful requests, holds & disclosure', icon: 'scale', link: '/legal', tint: 'tint-violet', perm: 'LEGAL:VIEW' },
        { label: 'Platform', desc: 'Staff, roles & audit log', icon: 'shield-check', link: '/team/staff', tint: 'tint-amber', perm: 'STAFF:VIEW' },
      ],
    },
  ],
};
