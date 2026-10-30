/**
 * Last representation and ETag per key (e.g. per device), so the BFF can send
 * `If-None-Match` and reuse its copy when the Core API answers `304`.
 */
export class EtagCache<T> {
  private entries = new Map<string, { etag: string; value: T }>();

  ifNoneMatch(key: string): string | undefined {
    return this.entries.get(key)?.etag;
  }

  /** The current value for an answer: the stored copy on 304, the new body otherwise. */
  resolve(key: string, status: number, etag: string | null, body: T | undefined): T | undefined {
    if (status === 304) return this.entries.get(key)?.value;
    if (body !== undefined && etag) this.entries.set(key, { etag, value: body });
    return body;
  }
}
