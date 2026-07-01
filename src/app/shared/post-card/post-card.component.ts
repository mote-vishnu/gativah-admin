import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../icon';
import { ContentDetail, GeoPoint } from '../../core/models';

interface Point { x: number; y: number; }
interface MentionSeg { text?: string; name?: string; userId?: number; }

/**
 * Feed-style rendering of a post or comment (mentions as deep links, media,
 * activity map, reactions, comments) — mirrors how the Gativah app shows a post.
 * Reused by the content browser and the grievance / report detail.
 */
@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TitleCasePipe, RouterLink, IconComponent],
  template: `
    @if (detail(); as d) {
      <article class="postcard">
        <header class="pc-head">
          <span class="av">{{ initials(d.authorUsername, d.authorUserId) }}</span>
          <div class="pc-id">
            <div class="pc-name">
              @if (d.authorUserId) { <a [routerLink]="['/users', d.authorUserId]">{{ d.authorUsername ? '@' + d.authorUsername : '#' + d.authorUserId }}</a> } @else { <b>Unknown</b> }
            </div>
            <div class="pc-meta">{{ d.createdAt | date: 'MMM d, y · HH:mm' }} · {{ d.privacy ? (d.privacy | titlecase) : (d.type | titlecase) }}@if (d.kind) { · {{ d.kind | titlecase }} }</div>
          </div>
          @if (d.removed) { <span class="pill banned">Removed</span> }
        </header>

        @if (d.type === 'COMMENT' && d.parentSnippet) {
          <div class="pc-parent"><lucide-icon name="corner-down-left" [size]="13" /> replying to <span class="muted">{{ plainMentions(d.parentSnippet) }}</span></div>
        }

        @if (d.content) {
          <div class="pc-body">@for (s of mentionSegs(d.content); track $index) {@if (s.userId) {<a class="mention" [routerLink]="['/users', s.userId]">{{ '@' + s.name }}</a>} @else {<span>{{ s.text }}</span>}}</div>
        }

        @if (d.activity; as act) {
          <div class="actcard">
            <div class="act-h"><lucide-icon [name]="act.activityType === 'CYCLING' ? 'webhook' : 'flag'" [size]="14" /> {{ act.activityType | titlecase }}</div>
            @if (act.route.length >= 2) {
              <svg class="act-map" viewBox="0 0 400 170" preserveAspectRatio="xMidYMid meet">
                <polyline class="rline" [attr.points]="routePolyline(act.route)" />
                @if (routeStart(act.route); as s0) { <circle class="rstart" [attr.cx]="s0.x" [attr.cy]="s0.y" r="4.5" /> }
                @if (routeEnd(act.route); as e0) { <circle class="rend" [attr.cx]="e0.x" [attr.cy]="e0.y" r="4.5" /> }
              </svg>
            }
            <div class="act-stats">
              @if (act.distanceKm != null) { <div class="st"><b>{{ act.distanceKm | number: '1.0-2' }}</b><span>km</span></div> }
              @if (act.durationSecs != null) { <div class="st"><b>{{ fmtDur(act.durationSecs) }}</b><span>time</span></div> }
              @if (act.paceMinPerKm != null) { <div class="st"><b>{{ act.paceMinPerKm | number: '1.0-2' }}</b><span>min/km</span></div> }
              @if (act.caloriesBurned != null) { <div class="st"><b>{{ act.caloriesBurned }}</b><span>kcal</span></div> }
            </div>
          </div>
        }

        @if (d.media.length) {
          <div class="pc-media" [class.single]="d.media.length === 1">
            @for (m of d.media; track m.url) {
              @if (m.mediaType === 'VIDEO') {
                <video class="pm pm-vid" controls preload="metadata" [src]="m.url ?? ''" [poster]="m.thumbnailUrl ?? ''"></video>
              } @else {
                <img class="pm" [src]="m.thumbnailUrl || m.url || ''" alt="post media" loading="lazy" referrerpolicy="no-referrer" />
              }
            }
          </div>
        }

        <div class="pc-engage">
          <div class="reacts">
            @if (d.reactionTotal > 0) {
              @for (rx of topReactions(d); track rx.type) { <span class="remoji">{{ emoji(rx.type) }}</span> }
              <span class="rc">{{ d.reactionTotal }}</span>
            } @else { <span class="muted">No reactions</span> }
          </div>
          <div class="counts">
            @if (d.type === 'POST') {
              <span><lucide-icon name="message-square" [size]="14" /> {{ d.commentCount }}</span>
              <span>{{ d.viewCount }} views</span>
            }
          </div>
        </div>

        @if (d.type === 'POST') {
          <div class="pc-comments">
            <div class="pcc-h">Comments</div>
            @for (cm of d.comments; track cm.id) {
              <div class="pcc" [class.gone]="cm.removed">
                <span class="av sm">{{ initials(cm.authorUsername, cm.authorUserId) }}</span>
                <div class="pcc-b">
                  <div class="pcc-head">
                    @if (cm.authorUserId) { <a [routerLink]="['/users', cm.authorUserId]"><b>{{ cm.authorUsername ? '@' + cm.authorUsername : '#' + cm.authorUserId }}</b></a> } @else { <b>—</b> }
                    <span class="muted">{{ cm.createdAt | date: 'MMM d, HH:mm' }}</span>
                    @if (cm.removed) { <span class="pill sm banned">removed</span> }
                  </div>
                  <div class="pcc-text">@for (s of mentionSegs(cm.content); track $index) {@if (s.userId) {<a class="mention" [routerLink]="['/users', s.userId]">{{ '@' + s.name }}</a>} @else {<span>{{ s.text }}</span>}}</div>
                </div>
              </div>
            } @empty { <p class="empty sm">No comments yet.</p> }
            @if (d.commentCount > d.comments.length) { <p class="empty sm">Showing {{ d.comments.length }} of {{ d.commentCount }} comments.</p> }
          </div>
        }
      </article>
    }
  `,
  styles: `
    .postcard { border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); }
    .pc-head { display: flex; align-items: center; gap: 12px; padding: 16px 18px 12px; }
    .av { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 50%; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; color: #fff; font-family: var(--sans); font-weight: 700; font-size: 15px; }
    .av.sm { width: 32px; height: 32px; font-size: 12px; }
    .pc-id { flex: 1; min-width: 0; }
    .pc-name a, .pc-name b { font-weight: 700; font-size: 14px; color: var(--ink); }
    .pc-meta { font-size: 11.5px; color: var(--muted-2); margin-top: 2px; }
    .pc-parent { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); padding: 0 18px 8px; }
    .pc-parent .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pc-body { padding: 4px 18px 14px; font-size: 15px; line-height: 1.6; color: var(--ink-2); white-space: pre-wrap; word-break: break-word; }
    .mention { color: var(--brand); font-weight: 600; }
    .mention:hover { text-decoration: underline; }
    .pc-media { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: var(--line); }
    .pc-media.single { grid-template-columns: 1fr; }
    .pm { aspect-ratio: 16/10; background: var(--surface-3) center/cover no-repeat; }
    img.pm { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pc-media.single .pm { aspect-ratio: 16/11; }
    .pm-vid { aspect-ratio: 16/10; width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
    .pc-media.single .pm-vid { aspect-ratio: 16/11; }
    .actcard { margin: 0 18px 14px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-2); }
    .act-h { display: flex; align-items: center; gap: 7px; padding: 11px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--brand); }
    .act-h lucide-icon { color: var(--brand); }
    .act-map { width: 100%; height: 180px; background: var(--surface-3); display: block; }
    .act-map .rline { fill: none; stroke: var(--brand); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .act-map .rstart { fill: var(--green); }
    .act-map .rend { fill: var(--rose); }
    .act-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 1px; background: var(--line); border-top: 1px solid var(--line); }
    .act-stats .st { background: var(--surface-2); padding: 11px 8px; text-align: center; }
    .act-stats .st b { display: block; font-family: var(--sans); font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .act-stats .st span { font-size: 10.5px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.03em; }
    .pc-engage { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-top: 1px solid var(--line); }
    .pc-engage .reacts { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 600; }
    .pc-engage .remoji { font-size: 15px; }
    .pc-engage .rc { margin-left: 5px; color: var(--muted); }
    .pc-engage .counts { display: inline-flex; gap: 16px; color: var(--muted-2); font-size: 12.5px; }
    .pc-engage .counts span { display: inline-flex; align-items: center; gap: 5px; }
    .pc-comments { border-top: 1px solid var(--line); padding: 14px 18px 16px; }
    .pcc-h { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); margin-bottom: 12px; }
    .pcc { display: flex; gap: 10px; padding: 8px 0; }
    .pcc.gone { opacity: 0.5; }
    .pcc-b { flex: 1; min-width: 0; }
    .pcc-head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
    .pcc-head a b { font-weight: 700; } .pcc-head .muted { font-size: 11px; color: var(--muted-2); }
    .pcc-text { font-size: 13px; color: var(--ink-2); margin-top: 2px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .empty.sm { font-size: 12px; color: var(--muted-2); padding: 8px 0; margin: 0; }
    .pill.sm { font-size: 10px; padding: 1px 6px; }
  `,
})
export class PostCardComponent {
  readonly detail = input.required<ContentDetail>();

  private readonly reactionEmoji: Record<string, string> = {
    LIKE: '👍', LOVE: '❤️', HAHA: '😂', WOW: '😮', CARE: '🤗', SAD: '😢', ANGRY: '😠', CELEBRATE: '🎉', STRONG: '💪',
  };

  emoji(type: string): string {
    return this.reactionEmoji[type] ?? (type.length <= 3 ? type : '•');
  }

  /** Up to 3 distinct reaction glyphs for the feed engagement bar. */
  topReactions(d: ContentDetail): { type: string }[] {
    return d.reactions.slice(0, 3);
  }

  fmtDur(secs: number | null): string {
    if (secs == null) { return '—'; }
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  /** Project a GPS route to a 400×170 viewBox (north up), padded, for the sketch. */
  private projectRoute(route: GeoPoint[]): Point[] {
    if (!route.length) { return []; }
    const lats = route.map((p) => p.lat), lngs = route.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1, spanLng = maxLng - minLng || 1;
    const pad = 14, w = 400 - pad * 2, h = 170 - pad * 2;
    return route.map((p) => ({
      x: pad + ((p.lng - minLng) / spanLng) * w,
      y: pad + (1 - (p.lat - minLat) / spanLat) * h,
    }));
  }

  routePolyline(route: GeoPoint[]): string {
    return this.projectRoute(route).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  routeStart(route: GeoPoint[]): Point | null {
    const p = this.projectRoute(route);
    return p.length ? p[0] : null;
  }

  routeEnd(route: GeoPoint[]): Point | null {
    const p = this.projectRoute(route);
    return p.length ? p[p.length - 1] : null;
  }

  /** Split content into plain-text + mention segments. Mentions are stored as `{@}[Name](userId)`. */
  mentionSegs(content: string | null): MentionSeg[] {
    if (!content) { return []; }
    const re = /\{@\}\[([^\]]+)\]\((\d+)\)/g;
    const out: MentionSeg[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) { out.push({ text: content.slice(last, m.index) }); }
      out.push({ name: m[1], userId: Number(m[2]) });
      last = re.lastIndex;
    }
    if (last < content.length) { out.push({ text: content.slice(last) }); }
    return out;
  }

  /** Flatten mention tokens to plain `@Name` for previews/snippets. */
  plainMentions(text: string | null): string {
    return (text || '').replace(/\{@\}\[([^\]]+)\]\((\d+)\)/g, '@$1');
  }

  initials(username: string | null, userId: number | null): string {
    const src = (username || '').replace(/[^a-zA-Z0-9]/g, '');
    if (src) { return src.slice(0, 2).toUpperCase(); }
    return userId ? String(userId).slice(0, 2) : '?';
  }
}
