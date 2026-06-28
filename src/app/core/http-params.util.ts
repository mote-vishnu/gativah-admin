import { HttpParams } from '@angular/common/http';

/** Append a filter param that may be a single value or an array (repeated key). */
export function appendMulti(params: HttpParams, key: string, value: string | string[] | null | undefined): HttpParams {
  if (value == null) { return params; }
  const list = Array.isArray(value) ? value : [value];
  for (const v of list) {
    if (v) { params = params.append(key, v); }
  }
  return params;
}
