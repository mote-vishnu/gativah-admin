import { Injectable } from '@angular/core';

export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Client-side CSV export of whatever rows a screen currently holds. Screens pass
 * a column map + rows; values are stringified and RFC-4180 escaped. (For very
 * large datasets a backend `?format=csv` endpoint would replace this — same call
 * site.)
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  download(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]): void {
    const head = columns.map((c) => esc(c.label)).join(',');
    const body = rows.map((r) => columns.map((c) => esc(format(r[c.key]))).join(',')).join('\r\n');
    const csv = head + '\r\n' + body;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

function format(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function esc(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
